import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUserIdentity } from "./auth";

/** Parse "Title (2020)" -> { title: "Title", year: "2020" } */
function parseTitleYear(raw: string): { searchQuery: string } {
  const m = raw.match(/^(.+?)\s*\((\d{4})\)\s*$/);
  if (m) {
    return { searchQuery: `${m[1].trim()} ${m[2]}` };
  }
  return { searchQuery: raw.trim() };
}

async function fetchTmdbMatch(searchQuery: string): Promise<{
  tmdbId: number;
  tmdbMediaType: string;
  posterPath: string | null;
  overview: string;
  voteAverage: number;
  genres?: string[];
  director?: string;
  runtime?: number;
} | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  const url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(searchQuery)}&include_adult=false&language=en-US&page=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, accept: "application/json" },
  });
  if (!res.ok) return null;

  type TmdbRaw = { id: number; media_type: string; title?: string; name?: string; poster_path?: string; overview?: string; vote_average?: number };
  const data = (await res.json()) as { results: TmdbRaw[] };
  const match = data.results?.find((r) => r.media_type === "movie" || r.media_type === "tv");
  if (!match) return null;

  const mediaType = match.media_type === "tv" ? "tv" : "movie";
  let genres: string[] | undefined;
  let director: string | undefined;

  const detailUrl = `https://api.themoviedb.org/3/${mediaType}/${match.id}?language=en-US&append_to_response=credits`;
  const detailRes = await fetch(detailUrl, {
    headers: { Authorization: `Bearer ${apiKey}`, accept: "application/json" },
  });
  let runtime: number | undefined;
  if (detailRes.ok) {
    type Genre = { id: number; name: string };
    type Crew = { job: string; name: string };
    const detail = (await detailRes.json()) as { genres?: Genre[]; credits?: { crew?: Crew[] }; runtime?: number };
    genres = detail.genres?.map((g) => g.name);
    director = detail.credits?.crew?.find((c) => c.job === "Director")?.name;
    runtime = detail.runtime ?? undefined;
  }

  return {
    tmdbId: match.id,
    tmdbMediaType: mediaType,
    posterPath: match.poster_path ? `https://image.tmdb.org/t/p/w200${match.poster_path}` : null,
    overview: match.overview ?? "",
    voteAverage: Math.round((match.vote_average ?? 0) * 10) / 10,
    genres,
    director,
    runtime,
  };
}

export const getMediaItem = internalQuery({
  args: { mediaId: v.id("mediaList") },
  handler: async (ctx, { mediaId }) => {
    return await ctx.db.get(mediaId);
  },
});

export const patchTmdbData = internalMutation({
  args: {
    mediaId: v.id("mediaList"),
    tmdbId: v.number(),
    tmdbMediaType: v.string(),
    posterPath: v.optional(v.string()),
    overview: v.optional(v.string()),
    voteAverage: v.optional(v.number()),
    genres: v.optional(v.array(v.string())),
    director: v.optional(v.string()),
    runtime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { mediaId, ...fields } = args;
    await ctx.db.patch(mediaId, fields);
  },
});

/** Internal action: enrich one media item with TMDB data. Skips if already has tmdbId. */
export const enrichOne = internalAction({
  args: { mediaId: v.id("mediaList") },
  handler: async (ctx, { mediaId }) => {
    const item = await ctx.runQuery(internal.tmdbEnrichment.getMediaItem, { mediaId });
    if (!item || item.tmdbId) return;

    const { searchQuery } = parseTitleYear(item.title);
    const match = await fetchTmdbMatch(searchQuery);
    if (!match) return;

    await ctx.runMutation(internal.tmdbEnrichment.patchTmdbData, {
      mediaId,
      tmdbId: match.tmdbId,
      tmdbMediaType: match.tmdbMediaType,
      posterPath: match.posterPath ?? undefined,
      overview: match.overview || undefined,
      voteAverage: match.voteAverage,
      genres: match.genres,
      director: match.director,
      runtime: match.runtime,
    });
  },
});

/** Schedule enrichment for each media ID with 2s delay between to avoid rate limits. */
export const scheduleEnrichmentForIds = internalAction({
  args: { mediaIds: v.array(v.id("mediaList")) },
  handler: async (ctx, { mediaIds }) => {
    const BATCH_DELAY_MS = 2000;
    for (let i = 0; i < mediaIds.length; i++) {
      await ctx.scheduler.runAfter(i * BATCH_DELAY_MS, internal.tmdbEnrichment.enrichOne, { mediaId: mediaIds[i] });
    }
  },
});

/** Cron: find items without tmdbId, schedule enrichment for up to 20 per run. */
export const enrichMissingTmdbCron = internalAction({
  args: {},
  handler: async (ctx) => {
    const ids = await ctx.runQuery(internal.tmdbEnrichment.getIdsWithoutTmdb);
    const toEnrich = ids.slice(0, 20);
    if (toEnrich.length > 0) {
      await ctx.runAction(internal.tmdbEnrichment.scheduleEnrichmentForIds, { mediaIds: toEnrich });
    }
  },
});

export const getIdsWithoutTmdb = internalQuery({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("mediaList").collect();
    return items.filter((i) => !i.tmdbId).map((i) => i._id);
  },
});

/** Public action: schedule TMDB enrichment for imported items. Call after bulkCreate. */
export const scheduleEnrichmentForImported = action({
  args: { mediaIds: v.array(v.id("mediaList")) },
  handler: async (ctx, { mediaIds }) => {
    await requireUserIdentity(ctx);
    if (mediaIds.length === 0) return;
    await ctx.scheduler.runAfter(0, internal.tmdbEnrichment.scheduleEnrichmentForIds, { mediaIds });
  },
});

/** Public action: manually trigger TMDB enrichment for items without metadata (same as daily cron). */
export const triggerEnrichmentNow = action({
  args: {},
  handler: async (ctx): Promise<{ scheduled: number }> => {
    await requireUserIdentity(ctx);
    const ids = await ctx.runQuery(internal.tmdbEnrichment.getIdsWithoutTmdb, {});
    const toEnrich = ids.slice(0, 20);
    if (toEnrich.length > 0) {
      await ctx.scheduler.runAfter(0, internal.tmdbEnrichment.scheduleEnrichmentForIds, { mediaIds: toEnrich });
    }
    return { scheduled: toEnrich.length };
  },
});

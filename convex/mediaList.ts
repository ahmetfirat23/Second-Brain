import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUserIdentity } from "./auth";

const categoryValidator = v.union(
  v.literal("Sitcom"),
  v.literal("Anime"),
  v.literal("Film"),
  v.literal("Documentary"),
  v.literal("Series"),
  v.literal("Other")
);

const tmdbFields = {
  tmdbId: v.optional(v.number()),
  tmdbMediaType: v.optional(v.string()),
  posterPath: v.optional(v.string()),
  overview: v.optional(v.string()),
  voteAverage: v.optional(v.number()),
  genres: v.optional(v.array(v.string())),
  director: v.optional(v.string()),
  runtime: v.optional(v.number()),
};

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireUserIdentity(ctx);
    const items = await ctx.db.query("mediaList").collect();
    return items.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

type MediaRow = { _id: Id<"mediaList">; tmdbId?: number; title: string; watchedAt?: string; watchedNotes?: string; userRating?: number; posterPath?: string; overview?: string; voteAverage?: number; genres?: string[]; director?: string; runtime?: number; tmdbMediaType?: string };

function findExisting(list: MediaRow[], item: { tmdbId?: number; title: string }): MediaRow | undefined {
  const norm = item.title.trim().toLowerCase();
  return list.find((e) => {
    if (item.tmdbId && e.tmdbId) return e.tmdbId === item.tmdbId;
    return e.title.trim().toLowerCase() === norm;
  });
}

// Keep for bulkCreate intra-batch dedup
function isDuplicate(list: { tmdbId?: number; title: string }[], item: { tmdbId?: number; title: string }): boolean {
  return !!findExisting(list as MediaRow[], item);
}

export const create = mutation({
  args: {
    title: v.string(),
    category: categoryValidator,
    notes: v.optional(v.string()),
    aiConsensus: v.optional(v.string()),
    ...tmdbFields,
  },
  handler: async (ctx, args) => {
    await requireUserIdentity(ctx);
    const all = await ctx.db.query("mediaList").collect();
    const existing = findExisting(all, args);

    if (existing) {
      if (existing.watchedAt) {
        // Rewatch — move back to to-watch, keep previous review data intact
        await ctx.db.patch(existing._id, { watchedAt: undefined });
        return { id: existing._id, action: "rewatch" as const };
      }
      // Already in list but not watched — fill in any missing TMDB fields
      const patch: Record<string, unknown> = {};
      if (args.posterPath   && !existing.posterPath)   patch.posterPath   = args.posterPath;
      if (args.overview     && !existing.overview)     patch.overview     = args.overview;
      if (args.voteAverage  && !existing.voteAverage)  patch.voteAverage  = args.voteAverage;
      if (args.genres?.length && !existing.genres?.length) patch.genres   = args.genres;
      if (args.director     && !existing.director)     patch.director     = args.director;
      if (args.runtime      && !existing.runtime)      patch.runtime      = args.runtime;
      if (args.tmdbId       && !existing.tmdbId)       patch.tmdbId       = args.tmdbId;
      if (args.tmdbMediaType && !existing.tmdbMediaType) patch.tmdbMediaType = args.tmdbMediaType;
      if (Object.keys(patch).length > 0) await ctx.db.patch(existing._id, patch);
      return { id: existing._id, action: "updated" as const };
    }

    const maxOrder = all.reduce((m, i) => Math.max(m, i.sortOrder), 0);
    const id = await ctx.db.insert("mediaList", { ...args, sortOrder: maxOrder + 1 });
    return { id, action: "created" as const };
  },
});

export const bulkCreateInternal = internalMutation({
  args: {
    items: v.array(
      v.object({
        title: v.string(),
        year: v.optional(v.string()),
        category: categoryValidator,
        watchedAt: v.optional(v.string()),
        watchedNotes: v.optional(v.string()),
        userRating: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, { items }) => {
    const all = await ctx.db.query("mediaList").collect();
    let maxOrder = all.reduce((m, i) => Math.max(m, i.sortOrder), 0);
    const batchSeen: { title: string }[] = [];
    const ids: string[] = [];
    let skipped = 0;
    for (const item of items) {
      if (isDuplicate(all, item) || isDuplicate(batchSeen, item)) { skipped++; continue; }
      maxOrder++;
      const id = await ctx.db.insert("mediaList", { ...item, sortOrder: maxOrder });
      ids.push(id as string);
      batchSeen.push({ title: item.title });
    }
    return { ids, skipped };
  },
});

export const bulkCreate = mutation({
  args: {
    items: v.array(
      v.object({
        title: v.string(),
        year: v.optional(v.string()),
        category: categoryValidator,
        notes: v.optional(v.string()),
        sourceDumpId: v.optional(v.id("brainDumps")),
        tmdbId: v.optional(v.number()),
        tmdbMediaType: v.optional(v.string()),
        posterPath: v.optional(v.string()),
        overview: v.optional(v.string()),
        voteAverage: v.optional(v.number()),
        genres: v.optional(v.array(v.string())),
        director: v.optional(v.string()),
        runtime: v.optional(v.number()),
        watchedAt: v.optional(v.string()),
        watchedNotes: v.optional(v.string()),
        userRating: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, { items }) => {
    await requireUserIdentity(ctx);
    const all = await ctx.db.query("mediaList").collect();
    let maxOrder = all.reduce((m, i) => Math.max(m, i.sortOrder), 0);

    const batchSeen: { tmdbId?: number; title: string }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids: any[] = [];
    let skipped = 0;
    let patched = 0;

    for (const item of items) {
      const existing = findExisting(all, item) ?? findExisting(batchSeen as MediaRow[], item);
      if (existing && "_id" in existing) {
        // Patch missing review/rating/watchedAt onto existing entry
        const patch: Record<string, unknown> = {};
        if (item.watchedNotes?.trim() && !existing.watchedNotes?.trim()) patch.watchedNotes = item.watchedNotes;
        if (item.userRating != null && existing.userRating == null) patch.userRating = item.userRating;
        if (item.watchedAt && !existing.watchedAt) patch.watchedAt = item.watchedAt;
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(existing._id, patch);
          patched++;
        } else {
          skipped++;
        }
        continue;
      }
      if (isDuplicate(batchSeen, item)) { skipped++; continue; }
      maxOrder++;
      const id = await ctx.db.insert("mediaList", { ...item, sortOrder: maxOrder });
      ids.push(id);
      batchSeen.push({ tmdbId: item.tmdbId, title: item.title });
    }

    return { ids, skipped, patched };
  },
});

export const update = mutation({
  args: {
    id: v.id("mediaList"),
    title: v.optional(v.string()),
    category: v.optional(categoryValidator),
    notes: v.optional(v.string()),
    aiConsensus: v.optional(v.string()),
    watchedAt: v.optional(v.string()),
    watchedNotes: v.optional(v.string()),
    userRating: v.optional(v.number()),
    ...tmdbFields,
  },
  handler: async (ctx, { id, ...fields }) => {
    await requireUserIdentity(ctx);
    await ctx.db.patch(id, fields);
  },
});

export const markWatched = mutation({
  args: {
    id: v.id("mediaList"),
    watchedNotes: v.optional(v.string()),
    userRating: v.optional(v.number()),
  },
  handler: async (ctx, { id, watchedNotes, userRating }) => {
    await requireUserIdentity(ctx);
    await ctx.db.patch(id, {
      watchedAt: new Date().toISOString(),
      watchedNotes: watchedNotes ?? undefined,
      userRating: userRating ?? undefined,
    });
  },
});

export const markUnwatched = mutation({
  args: { id: v.id("mediaList") },
  handler: async (ctx, { id }) => {
    await requireUserIdentity(ctx);
    await ctx.db.patch(id, {
      watchedAt: undefined,
      watchedNotes: undefined,
      userRating: undefined,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("mediaList") },
  handler: async (ctx, { id }) => {
    await requireUserIdentity(ctx);
    await ctx.db.delete(id);
  },
});

export const removeBySourceDumpId = mutation({
  args: { sourceDumpId: v.id("brainDumps") },
  handler: async (ctx, { sourceDumpId }) => {
    await requireUserIdentity(ctx);
    const items = await ctx.db.query("mediaList").collect();
    await Promise.all(items.filter((i) => i.sourceDumpId === sourceDumpId).map((i) => ctx.db.delete(i._id)));
  },
});

export const patchReviews = internalMutation({
  args: {
    items: v.array(v.object({
      title: v.string(),
      year: v.optional(v.string()),
      watchedNotes: v.optional(v.string()),
      userRating: v.optional(v.number()),
      watchedAt: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { items }) => {
    const all = await ctx.db.query("mediaList").collect();
    let patched = 0, skipped = 0;
    for (const item of items) {
      const norm = item.title.trim().toLowerCase();
      const existing = all.find((e) => e.title.trim().toLowerCase() === norm);
      if (!existing) { skipped++; continue; }
      const patch: Record<string, unknown> = {};
      if (item.watchedNotes?.trim() && !existing.watchedNotes?.trim()) patch.watchedNotes = item.watchedNotes;
      if (item.userRating != null && existing.userRating == null) patch.userRating = item.userRating;
      if (item.watchedAt && !existing.watchedAt) patch.watchedAt = item.watchedAt;
      if (Object.keys(patch).length > 0) { await ctx.db.patch(existing._id, patch); patched++; }
      else skipped++;
    }
    return { patched, skipped };
  },
});

export const reorder = mutation({
  args: { orderedIds: v.array(v.id("mediaList")) },
  handler: async (ctx, { orderedIds }) => {
    await requireUserIdentity(ctx);
    await Promise.all(
      orderedIds.map((id, index) => ctx.db.patch(id, { sortOrder: index }))
    );
  },
});

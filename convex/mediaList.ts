import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
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

export const create = mutation({
  args: {
    title: v.string(),
    category: categoryValidator,
    notes: v.optional(v.string()),
    aiConsensus: v.optional(v.string()),
    ...tmdbFields,
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("mediaList").collect();
    const maxOrder = all.reduce((m, i) => Math.max(m, i.sortOrder), 0);
    return ctx.db.insert("mediaList", { ...args, sortOrder: maxOrder + 1 });
  },
});

export const bulkCreate = mutation({
  args: {
    items: v.array(
      v.object({
        title: v.string(),
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
    const baseOrder = all.reduce((m, i) => Math.max(m, i.sortOrder), 0) + 1;
    const ids = [];
    for (let i = 0; i < items.length; i++) {
      const id = await ctx.db.insert("mediaList", { ...items[i], sortOrder: baseOrder + i });
      ids.push(id);
    }
    return ids;
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

export const reorder = mutation({
  args: { orderedIds: v.array(v.id("mediaList")) },
  handler: async (ctx, { orderedIds }) => {
    await requireUserIdentity(ctx);
    await Promise.all(
      orderedIds.map((id, index) => ctx.db.patch(id, { sortOrder: index }))
    );
  },
});

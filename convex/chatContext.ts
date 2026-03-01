import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserIdentity } from "./auth";

export const get = query({
  args: {},
  handler: async (ctx) => {
    await requireUserIdentity(ctx);
    const row = await ctx.db.query("chatContext").first();
    return row?.pinnedMediaIds ?? [];
  },
});

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireUserIdentity(ctx);
    const row = await ctx.db.query("chatContext").first();
    return {
      pinnedMediaIds: row?.pinnedMediaIds ?? [],
      autoInclude: row?.autoInclude ?? "all",
      autoIncludeLimit: row?.autoIncludeLimit ?? 15,
      autoIncludeEnabled: row?.autoIncludeEnabled ?? false,
      includeRatings: row?.includeRatings ?? true,
      useLimitMode: row?.useLimitMode ?? false,
    };
  },
});

export const setAutoIncludeEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    await requireUserIdentity(ctx);
    let row = await ctx.db.query("chatContext").first();
    if (!row) {
      await ctx.db.insert("chatContext", { pinnedMediaIds: [], autoIncludeEnabled: enabled });
    } else {
      await ctx.db.patch(row._id, { autoIncludeEnabled: enabled });
    }
  },
});

export const setIncludeRatings = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    await requireUserIdentity(ctx);
    let row = await ctx.db.query("chatContext").first();
    if (!row) {
      await ctx.db.insert("chatContext", { pinnedMediaIds: [], includeRatings: enabled });
    } else {
      await ctx.db.patch(row._id, { includeRatings: enabled });
    }
  },
});

export const setUseLimitMode = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    await requireUserIdentity(ctx);
    let row = await ctx.db.query("chatContext").first();
    if (!row) {
      await ctx.db.insert("chatContext", { pinnedMediaIds: [], useLimitMode: enabled });
    } else {
      await ctx.db.patch(row._id, { useLimitMode: enabled });
    }
  },
});

export const togglePinned = mutation({
  args: { mediaId: v.id("mediaList") },
  handler: async (ctx, { mediaId }) => {
    await requireUserIdentity(ctx);
    let row = await ctx.db.query("chatContext").first();
    const current = row?.pinnedMediaIds ?? [];
    const has = current.includes(mediaId);
    const next = has ? current.filter((id) => id !== mediaId) : [...current, mediaId];

    if (!row) {
      await ctx.db.insert("chatContext", { pinnedMediaIds: next });
    } else {
      await ctx.db.patch(row._id, { pinnedMediaIds: next });
    }
    return !has;
  },
});

export const setAutoInclude = mutation({
  args: {
    mode: v.union(v.literal("none"), v.literal("recent"), v.literal("with_reviews"), v.literal("all"), v.literal("all_with_ratings")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { mode, limit }) => {
    await requireUserIdentity(ctx);
    let row = await ctx.db.query("chatContext").first();
    const patch = { autoInclude: mode, autoIncludeLimit: limit ?? 10 };
    if (!row) {
      await ctx.db.insert("chatContext", { pinnedMediaIds: [], autoIncludeEnabled: false, ...patch });
    } else {
      await ctx.db.patch(row._id, patch);
    }
  },
});

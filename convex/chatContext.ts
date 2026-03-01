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
    const rawModel = (row?.aiGptModel ?? "gpt-5-nano") as string;
    const aiGptModel = rawModel === "gpt-4o-mini" ? "gpt-5-mini" : rawModel === "gpt-4o-nano" ? "gpt-5-nano" : rawModel;
    return {
      pinnedMediaIds: row?.pinnedMediaIds ?? [],
      autoInclude: row?.autoInclude ?? "all",
      autoIncludeLimit: row?.autoIncludeLimit ?? 15,
      autoIncludeEnabled: row?.autoIncludeEnabled ?? false,
      includeRatings: row?.includeRatings ?? true,
      useLimitMode: row?.useLimitMode ?? false,
      aiProvider: row?.aiProvider ?? "gpt",
      aiGptModel: aiGptModel as "gpt-5-mini" | "gpt-5-nano",
    };
  },
});

export const setAiPreferences = mutation({
  args: {
    aiProvider: v.union(v.literal("grok"), v.literal("gpt")),
    aiGptModel: v.optional(v.union(v.literal("gpt-5-mini"), v.literal("gpt-5-nano"))),
  },
  handler: async (ctx, { aiProvider, aiGptModel }) => {
    await requireUserIdentity(ctx);
    let row = await ctx.db.query("chatContext").first();
    const patch = { aiProvider, aiGptModel: aiGptModel ?? "gpt-5-nano" };
    if (!row) {
      await ctx.db.insert("chatContext", { pinnedMediaIds: [], ...patch });
    } else {
      await ctx.db.patch(row._id, patch);
    }
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

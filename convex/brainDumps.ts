import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserIdentity } from "./auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireUserIdentity(ctx);
    return ctx.db.query("brainDumps").order("desc").take(100);
  },
});

export const getPending = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("brainDumps").order("asc").collect();
    return all.filter((d) => d.tidiedAt === undefined && !d.noMerge);
  },
});

export const getPendingCount = query({
  args: {},
  handler: async (ctx) => {
    await requireUserIdentity(ctx);
    const all = await ctx.db.query("brainDumps").collect();
    return all.filter((d) => d.tidiedAt === undefined && !d.noMerge).length;
  },
});

export const save = mutation({
  args: { content: v.string(), title: v.optional(v.string()) },
  handler: async (ctx, { content, title }) => {
    await requireUserIdentity(ctx);
    return ctx.db.insert("brainDumps", { content, title });
  },
});

export const setTidied = mutation({
  args: {
    id: v.id("brainDumps"),
    tidiedContent: v.string(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, { id, tidiedContent, title }) => {
    await requireUserIdentity(ctx);
    const patch: Record<string, unknown> = { tidiedContent };
    if (title) patch.title = title;
    await ctx.db.patch(id, patch);
  },
});

export const markTidied = mutation({
  args: { id: v.id("brainDumps") },
  handler: async (ctx, { id }) => {
    await requireUserIdentity(ctx);
    await ctx.db.patch(id, { tidiedAt: new Date().toISOString() });
  },
});

export const uncheck = mutation({
  args: { id: v.id("brainDumps") },
  handler: async (ctx, { id }) => {
    await requireUserIdentity(ctx);
    await ctx.db.patch(id, { tidiedAt: undefined });
  },
});

export const toggleNoMerge = mutation({
  args: { id: v.id("brainDumps") },
  handler: async (ctx, { id }) => {
    await requireUserIdentity(ctx);
    const dump = await ctx.db.get(id);
    if (!dump) return;
    await ctx.db.patch(id, { noMerge: !dump.noMerge });
  },
});

export const update = mutation({
  args: {
    id: v.id("brainDumps"),
    content: v.optional(v.string()),
    tidiedContent: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, { id, content, tidiedContent, title }) => {
    await requireUserIdentity(ctx);
    const patch: Record<string, unknown> = {};
    if (content !== undefined) patch.content = content;
    if (tidiedContent !== undefined) patch.tidiedContent = tidiedContent;
    if (title !== undefined) patch.title = title;
    if (Object.keys(patch).length > 0) await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("brainDumps") },
  handler: async (ctx, { id }) => {
    await requireUserIdentity(ctx);
    await ctx.db.delete(id);
  },
});

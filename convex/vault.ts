import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserIdentity } from "./auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireUserIdentity(ctx);
    const items = await ctx.db.query("vault").collect();
    return items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || b._creationTime - a._creationTime);
  },
});

export const create = mutation({
  args: { title: v.string(), url: v.string(), urgency: v.number() },
  handler: async (ctx, args) => {
    await requireUserIdentity(ctx);
    const all = await ctx.db.query("vault").collect();
    const maxOrder = all.reduce((m, i) => Math.max(m, i.sortOrder ?? 0), 0);
    return ctx.db.insert("vault", { ...args, sortOrder: maxOrder + 1 });
  },
});

export const reorder = mutation({
  args: { orderedIds: v.array(v.id("vault")) },
  handler: async (ctx, { orderedIds }) => {
    await requireUserIdentity(ctx);
    await Promise.all(orderedIds.map((id, i) => ctx.db.patch(id, { sortOrder: i })));
  },
});

export const bulkCreate = mutation({
  args: {
    items: v.array(
      v.object({ title: v.string(), url: v.string(), urgency: v.number(), sourceDumpId: v.optional(v.id("brainDumps")) })
    ),
  },
  handler: async (ctx, { items }) => {
    await requireUserIdentity(ctx);
    return Promise.all(items.map((item) => ctx.db.insert("vault", item)));
  },
});

export const update = mutation({
  args: {
    id: v.id("vault"),
    title: v.optional(v.string()),
    url: v.optional(v.string()),
    urgency: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await requireUserIdentity(ctx);
    await ctx.db.patch(id, fields);
  },
});

export const remove = mutation({
  args: { id: v.id("vault") },
  handler: async (ctx, { id }) => {
    await requireUserIdentity(ctx);
    await ctx.db.delete(id);
  },
});

export const removeBySourceDumpId = mutation({
  args: { sourceDumpId: v.id("brainDumps") },
  handler: async (ctx, { sourceDumpId }) => {
    await requireUserIdentity(ctx);
    const items = await ctx.db.query("vault").collect();
    await Promise.all(items.filter((i) => i.sourceDumpId === sourceDumpId).map((i) => ctx.db.delete(i._id)));
  },
});

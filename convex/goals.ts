import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserIdentity } from "./auth";

const SIZE_THRESHOLDS = { short: 5, medium: 10, long: 15 };

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireUserIdentity(ctx);
    const items = await ctx.db.query("goals").collect();
    return items.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const getOverdue = query({
  args: {},
  handler: async (ctx) => {
    await requireUserIdentity(ctx);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const items = await ctx.db.query("goals").collect();
    return items.filter((g) => {
      if (g.status !== "in_progress" || !g.startedAt) return false;
      const started = new Date(g.startedAt);
      started.setHours(0, 0, 0, 0);
      const days = Math.floor((today.getTime() - started.getTime()) / 86400000);
      return days > SIZE_THRESHOLDS[g.size];
    });
  },
});

const goalInsertValidator = v.object({
  title: v.string(),
  description: v.optional(v.string()),
  importance: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4), v.literal(5)),
  size: v.union(v.literal("short"), v.literal("medium"), v.literal("long")),
  sourceDumpId: v.optional(v.id("brainDumps")),
});

export const bulkCreate = mutation({
  args: { items: v.array(goalInsertValidator) },
  handler: async (ctx, { items }) => {
    await requireUserIdentity(ctx);
    const all = await ctx.db.query("goals").collect();
    let maxOrder = all.reduce((m, g) => Math.max(m, g.sortOrder), -1);
    for (const item of items) {
      maxOrder++;
      await ctx.db.insert("goals", {
        ...item,
        status: "not_started",
        sortOrder: maxOrder,
      });
    }
  },
});

export const removeBySourceDumpId = mutation({
  args: { sourceDumpId: v.id("brainDumps") },
  handler: async (ctx, { sourceDumpId }) => {
    await requireUserIdentity(ctx);
    const all = await ctx.db.query("goals").collect();
    const toRemove = all.filter((g) => g.sourceDumpId === sourceDumpId);
    await Promise.all(toRemove.map((g) => ctx.db.delete(g._id)));
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    importance: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4), v.literal(5)),
    size: v.union(v.literal("short"), v.literal("medium"), v.literal("long")),
  },
  handler: async (ctx, args) => {
    await requireUserIdentity(ctx);
    const all = await ctx.db.query("goals").collect();
    const maxOrder = all.reduce((m, g) => Math.max(m, g.sortOrder), -1);
    return ctx.db.insert("goals", {
      ...args,
      status: "not_started",
      sortOrder: maxOrder + 1,
    });
  },
});

export const setStatus = mutation({
  args: {
    id: v.id("goals"),
    status: v.union(v.literal("not_started"), v.literal("in_progress"), v.literal("done")),
  },
  handler: async (ctx, { id, status }) => {
    await requireUserIdentity(ctx);
    const patch: Record<string, unknown> = { status };
    if (status === "in_progress") patch.startedAt = new Date().toISOString().split("T")[0];
    if (status === "done") patch.doneAt = new Date().toISOString().split("T")[0];
    if (status === "not_started") { patch.startedAt = undefined; patch.doneAt = undefined; }
    await ctx.db.patch(id, patch);
  },
});

export const update = mutation({
  args: {
    id: v.id("goals"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    importance: v.optional(v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4), v.literal(5))),
    size: v.optional(v.union(v.literal("short"), v.literal("medium"), v.literal("long"))),
  },
  handler: async (ctx, { id, ...fields }) => {
    await requireUserIdentity(ctx);
    await ctx.db.patch(id, fields);
  },
});

export const remove = mutation({
  args: { id: v.id("goals") },
  handler: async (ctx, { id }) => {
    await requireUserIdentity(ctx);
    await ctx.db.delete(id);
  },
});

export const reorder = mutation({
  args: { orderedIds: v.array(v.id("goals")) },
  handler: async (ctx, { orderedIds }) => {
    await requireUserIdentity(ctx);
    await Promise.all(
      orderedIds.map((id, index) => ctx.db.patch(id, { sortOrder: index }))
    );
  },
});

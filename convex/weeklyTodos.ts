import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireUserIdentity } from "./auth";

export const list = query({
  handler: async (ctx) => {
    await requireUserIdentity(ctx);
    return ctx.db.query("weeklyTodos").order("asc").collect();
  },
});

export const create = mutation({
  args: { text: v.string(), urgency: v.number(), scheduledDate: v.optional(v.string()) },
  handler: async (ctx, { text, urgency, scheduledDate }) => {
    await requireUserIdentity(ctx);
    const all = await ctx.db.query("weeklyTodos").collect();
    const maxOrder = all.reduce((m, i) => Math.max(m, i.sortOrder), -1);
    return ctx.db.insert("weeklyTodos", {
      text: text.trim(),
      done: false,
      urgency: Math.min(5, Math.max(1, urgency)),
      sortOrder: maxOrder + 1,
      ...(scheduledDate ? { scheduledDate } : {}),
    });
  },
});

export const toggleDone = mutation({
  args: { id: v.id("weeklyTodos") },
  handler: async (ctx, { id }) => {
    await requireUserIdentity(ctx);
    const item = await ctx.db.get(id);
    if (!item) return;
    const nowDone = !item.done;
    await ctx.db.patch(id, { done: nowDone, doneAt: nowDone ? Date.now() : undefined });
  },
});

export const update = mutation({
  args: {
    id: v.id("weeklyTodos"),
    text: v.optional(v.string()),
    urgency: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await requireUserIdentity(ctx);
    const patch: Record<string, unknown> = {};
    if (fields.text !== undefined) patch.text = fields.text.trim();
    if (fields.urgency !== undefined) patch.urgency = Math.min(5, Math.max(1, fields.urgency));
    if (Object.keys(patch).length > 0) await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("weeklyTodos") },
  handler: async (ctx, { id }) => {
    await requireUserIdentity(ctx);
    await ctx.db.delete(id);
  },
});

export const reorder = mutation({
  args: { orderedIds: v.array(v.id("weeklyTodos")) },
  handler: async (ctx, { orderedIds }) => {
    await requireUserIdentity(ctx);
    await Promise.all(orderedIds.map((id, i) => ctx.db.patch(id, { sortOrder: i })));
  },
});

export const scheduleForDate = mutation({
  args: { id: v.id("weeklyTodos"), date: v.string() },
  handler: async (ctx, { id, date }) => {
    await requireUserIdentity(ctx);
    await ctx.db.patch(id, { scheduledDate: date });
  },
});

export const unschedule = mutation({
  args: { id: v.id("weeklyTodos") },
  handler: async (ctx, { id }) => {
    await requireUserIdentity(ctx);
    await ctx.db.patch(id, { scheduledDate: undefined });
  },
});

// Internal: delete done items older than 24h
export const cleanupDoneInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const items = await ctx.db.query("weeklyTodos").collect();
    const stale = items.filter((i) => i.done && i.doneAt !== undefined && i.doneAt < cutoff);
    await Promise.all(stale.map((i) => ctx.db.delete(i._id)));
    return stale.length;
  },
});

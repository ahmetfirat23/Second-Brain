import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserIdentity } from "./auth";

export const listForDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    await requireUserIdentity(ctx);
    return ctx.db
      .query("dailyTodos")
      .withIndex("by_date", (q) => q.eq("date", date))
      .order("asc")
      .collect();
  },
});

export const create = mutation({
  args: {
    date: v.string(),
    text: v.string(),
    urgency: v.number(),
  },
  handler: async (ctx, { date, text, urgency }) => {
    const existing = await ctx.db
      .query("dailyTodos")
      .withIndex("by_date", (q) => q.eq("date", date))
      .collect();
    const maxOrder = existing.reduce((m, i) => Math.max(m, i.sortOrder), -1);
    return ctx.db.insert("dailyTodos", {
      date,
      text: text.trim(),
      done: false,
      urgency: Math.min(5, Math.max(1, urgency)),
      sortOrder: maxOrder + 1,
    });
  },
});

export const toggleDone = mutation({
  args: { id: v.id("dailyTodos") },
  handler: async (ctx, { id }) => {
    await requireUserIdentity(ctx);
    const item = await ctx.db.get(id);
    if (!item) return;
    await ctx.db.patch(id, { done: !item.done });
  },
});

export const update = mutation({
  args: {
    id: v.id("dailyTodos"),
    text: v.optional(v.string()),
    urgency: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const patch: Record<string, unknown> = {};
    if (fields.text !== undefined) patch.text = fields.text.trim();
    if (fields.urgency !== undefined) patch.urgency = Math.min(5, Math.max(1, fields.urgency));
    if (Object.keys(patch).length > 0) await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("dailyTodos") },
  handler: async (ctx, { id }) => {
    await requireUserIdentity(ctx);
    await ctx.db.delete(id);
  },
});

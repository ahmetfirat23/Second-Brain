import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { requireUserIdentity } from "./auth";

function sm2(
  rating: 0 | 1 | 2 | 3,
  easeFactor: number,
  interval: number,
  repetitions: number
) {
  let newEase = easeFactor + (0.1 - (3 - rating) * (0.08 + (3 - rating) * 0.02));
  newEase = Math.max(1.3, newEase);

  let newInterval: number;
  let newReps: number;

  if (rating < 2) {
    newInterval = 1;
    newReps = 0;
  } else {
    newReps = repetitions + 1;
    if (newReps === 1) newInterval = 1;
    else if (newReps === 2) newInterval = 6;
    else newInterval = Math.round(interval * newEase);
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + newInterval);
  const nextReview = nextDate.toISOString().split("T")[0];

  return {
    easeFactor: Math.round(newEase * 1000) / 1000,
    interval: newInterval,
    repetitions: newReps,
    nextReview,
  };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireUserIdentity(ctx);
    const items = await ctx.db.query("knowledgeCards").collect();
    return items.sort((a, b) => a.nextReview.localeCompare(b.nextReview));
  },
});

export const getDue = query({
  args: {},
  handler: async (ctx) => {
    await requireUserIdentity(ctx);
    const today = new Date().toISOString().split("T")[0];
    const items = await ctx.db.query("knowledgeCards").collect();
    return items
      .filter((c) => c.nextReview <= today)
      .sort((a, b) => a.nextReview.localeCompare(b.nextReview));
  },
});

export const getDueCount = query({
  args: {},
  handler: async (ctx) => {
    await requireUserIdentity(ctx);
    const today = new Date().toISOString().split("T")[0];
    const items = await ctx.db.query("knowledgeCards").collect();
    return items.filter((c) => c.nextReview <= today).length;
  },
});

export const create = mutation({
  args: { front: v.string(), back: v.string() },
  handler: async (ctx, { front, back }) => {
    await requireUserIdentity(ctx);
    const today = new Date().toISOString().split("T")[0];
    return ctx.db.insert("knowledgeCards", {
      front,
      back,
      easeFactor: 2.5,
      interval: 1,
      repetitions: 0,
      nextReview: today,
    });
  },
});

export const bulkCreate = mutation({
  args: {
    items: v.array(v.object({ front: v.string(), back: v.string(), sourceDumpId: v.optional(v.id("brainDumps")) })),
  },
  handler: async (ctx, { items }) => {
    await requireUserIdentity(ctx);
    const today = new Date().toISOString().split("T")[0];
    await Promise.all(
      items.map((item) => {
        const { sourceDumpId, ...rest } = item;
        return ctx.db.insert("knowledgeCards", {
          ...rest,
          sourceDumpId,
          easeFactor: 2.5,
          interval: 1,
          repetitions: 0,
          nextReview: today,
        });
      })
    );
  },
});

export const review = mutation({
  args: { id: v.id("knowledgeCards"), rating: v.union(v.literal(0), v.literal(1), v.literal(2), v.literal(3)) },
  handler: async (ctx, { id, rating }) => {
    await requireUserIdentity(ctx);
    const card = await ctx.db.get(id);
    if (!card) throw new Error("Card not found");
    const result = sm2(rating, card.easeFactor, card.interval, card.repetitions);
    await ctx.db.patch(id, result);
    return result;
  },
});

export const update = mutation({
  args: {
    id: v.id("knowledgeCards"),
    front: v.optional(v.string()),
    back: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await requireUserIdentity(ctx);
    await ctx.db.patch(id, fields);
  },
});

export const remove = mutation({
  args: { id: v.id("knowledgeCards") },
  handler: async (ctx, { id }) => {
    await requireUserIdentity(ctx);
    await ctx.db.delete(id);
  },
});

export const removeBySourceDumpId = mutation({
  args: { sourceDumpId: v.id("brainDumps") },
  handler: async (ctx, { sourceDumpId }) => {
    await requireUserIdentity(ctx);
    const items = await ctx.db.query("knowledgeCards").collect();
    await Promise.all(items.filter((i) => i.sourceDumpId === sourceDumpId).map((i) => ctx.db.delete(i._id)));
  },
});

export const bulkAssignTopics = mutation({
  args: { assignments: v.array(v.object({ id: v.id("knowledgeCards"), topic: v.string() })) },
  handler: async (ctx, { assignments }) => {
    await requireUserIdentity(ctx);
    await Promise.all(assignments.map(({ id, topic }) => ctx.db.patch(id, { topic })));
  },
});

export const clearAllTopics = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserIdentity(ctx);
    const items = await ctx.db.query("knowledgeCards").collect();
    await Promise.all(items.map((i) => ctx.db.patch(i._id, { topic: undefined })));
  },
});

// Internal versions for cron (no auth required)
export const listInternal = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("knowledgeCards").collect(),
});

export const bulkAssignTopicsInternal = internalMutation({
  args: { assignments: v.array(v.object({ id: v.id("knowledgeCards"), topic: v.string() })) },
  handler: async (ctx, { assignments }) => {
    await Promise.all(assignments.map(({ id, topic }) => ctx.db.patch(id, { topic })));
  },
});

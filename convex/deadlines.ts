import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserIdentity } from "./auth";

const categoryValidator = v.union(
  v.literal("Job"),
  v.literal("Lecture"),
  v.literal("Other")
);

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireUserIdentity(ctx);
    const items = await ctx.db.query("deadlines").collect();
    return items.sort((a, b) => a.deadline.localeCompare(b.deadline));
  },
});

export const create = mutation({
  args: {
    task: v.string(),
    deadline: v.string(),
    category: categoryValidator,
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("deadlines", args);
  },
});

export const bulkCreate = mutation({
  args: {
    items: v.array(
      v.object({
        task: v.string(),
        deadline: v.string(),
        category: categoryValidator,
        sourceDumpId: v.optional(v.id("brainDumps")),
      })
    ),
  },
  handler: async (ctx, { items }) => {
    await requireUserIdentity(ctx);
    await Promise.all(items.map((item) => ctx.db.insert("deadlines", item)));
  },
});

export const update = mutation({
  args: {
    id: v.id("deadlines"),
    task: v.optional(v.string()),
    deadline: v.optional(v.string()),
    category: v.optional(categoryValidator),
  },
  handler: async (ctx, { id, ...fields }) => {
    await requireUserIdentity(ctx);
    await ctx.db.patch(id, fields);
  },
});

export const remove = mutation({
  args: { id: v.id("deadlines") },
  handler: async (ctx, { id }) => {
    await requireUserIdentity(ctx);
    await ctx.db.delete(id);
  },
});

export const removeBySourceDumpId = mutation({
  args: { sourceDumpId: v.id("brainDumps") },
  handler: async (ctx, { sourceDumpId }) => {
    await requireUserIdentity(ctx);
    const items = await ctx.db.query("deadlines").collect();
    await Promise.all(items.filter((i) => i.sourceDumpId === sourceDumpId).map((i) => ctx.db.delete(i._id)));
  },
});

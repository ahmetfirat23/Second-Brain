import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserIdentity } from "./auth";

export const get = query({
  args: {},
  handler: async (ctx) => {
    await requireUserIdentity(ctx);
    const row = await ctx.db.query("tasteSummary").order("desc").first();
    return row ?? null;
  },
});

export const set = mutation({
  args: { summary: v.string(), updatedAt: v.string() },
  handler: async (ctx, { summary, updatedAt }) => {
    await requireUserIdentity(ctx);
    const existing = await ctx.db.query("tasteSummary").first();
    if (existing) {
      await ctx.db.patch(existing._id, { summary, updatedAt });
      return existing._id;
    }
    return ctx.db.insert("tasteSummary", { summary, updatedAt });
  },
});

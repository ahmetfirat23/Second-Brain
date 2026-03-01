import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUserIdentity } from "./auth";

/**
 * Clears all data from the database. Run via:
 *   npx convex run clearData:clearAll '{"confirm": "DELETE_ALL"}'
 *
 * Or from Convex Dashboard → Functions → clearData:clearAll
 */
export const clearAll = mutation({
  args: { confirm: v.string() },
  handler: async (ctx, { confirm }) => {
    await requireUserIdentity(ctx);
    if (confirm !== "DELETE_ALL") {
      throw new Error('Must pass confirm: "DELETE_ALL" to clear all data');
    }

    const tables = [
      "apiUsage",
      "dailyTodos",
      "goals",
      "knowledgeCards",
      "vault",
      "deadlines",
      "chatContext",
      "mediaList",
      "tasteSummary",
      "brainDumps",
    ] as const;

    for (const table of tables) {
      const docs = await ctx.db.query(table).collect();
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
      }
    }

    return { cleared: tables };
  },
});

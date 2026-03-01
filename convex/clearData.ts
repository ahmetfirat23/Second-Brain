import { internalMutation } from "./_generated/server";

const TABLES = [
  "apiUsage", "dailyTodos", "goals", "knowledgeCards", "vault",
  "deadlines", "chatContext", "mediaList", "tasteSummary", "brainDumps",
] as const;

/**
 * Clears all data. CLI only — cannot be called from the browser.
 * Run via:  npx convex run clearData:clearAll
 */
export const clearAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const table of TABLES) {
      const docs = await ctx.db.query(table).collect();
      for (const doc of docs) await ctx.db.delete(doc._id);
    }
    return { cleared: TABLES };
  },
});

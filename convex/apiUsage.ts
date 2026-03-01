import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserIdentity } from "./auth";

// Grok grok-4-1-fast-reasoning: $0.20/1M input, $0.50/1M output
const GROK_INPUT_PER_1M = 0.2;
const GROK_OUTPUT_PER_1M = 0.5;

export const log = mutation({
  args: {
    source: v.string(),
    provider: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
  },
  handler: async (ctx, { source, provider, inputTokens, outputTokens }) => {
    let estimatedCostUsd = 0;
    if (provider === "grok") {
      estimatedCostUsd =
        (inputTokens / 1_000_000) * GROK_INPUT_PER_1M +
        (outputTokens / 1_000_000) * GROK_OUTPUT_PER_1M;
    }
    await ctx.db.insert("apiUsage", {
      source,
      provider,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
    });
  },
});

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 100 }) => {
    await requireUserIdentity(ctx);
    return ctx.db
      .query("apiUsage")
      .order("desc")
      .take(limit);
  },
});

function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    await requireUserIdentity(ctx);
    const all = await ctx.db.query("apiUsage").collect();
    const bySource: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }> = {};
    const byDay: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }> = {};
    let totalCalls = 0;
    let totalInput = 0;
    let totalOutput = 0;
    let totalCost = 0;

    for (const row of all) {
      const day = formatDate(row._creationTime);
      totalCalls++;
      totalInput += row.inputTokens;
      totalOutput += row.outputTokens;
      totalCost += row.estimatedCostUsd;

      if (!bySource[row.source]) {
        bySource[row.source] = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
      }
      bySource[row.source].calls++;
      bySource[row.source].inputTokens += row.inputTokens;
      bySource[row.source].outputTokens += row.outputTokens;
      bySource[row.source].costUsd += row.estimatedCostUsd;

      if (!byDay[day]) {
        byDay[day] = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
      }
      byDay[day].calls++;
      byDay[day].inputTokens += row.inputTokens;
      byDay[day].outputTokens += row.outputTokens;
      byDay[day].costUsd += row.estimatedCostUsd;
    }

    // Sort days descending (newest first)
    const dailySorted = Object.entries(byDay).sort(([a], [b]) => b.localeCompare(a));

    return {
      overall: {
        calls: totalCalls,
        inputTokens: totalInput,
        outputTokens: totalOutput,
        costUsd: totalCost,
      },
      bySource,
      byDay: dailySorted.map(([date, s]) => ({ date, ...s })),
    };
  },
});

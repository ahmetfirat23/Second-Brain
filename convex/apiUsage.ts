import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUserIdentity } from "./auth";

// Grok grok-4-1-fast-reasoning: $0.20/1M input, $0.50/1M output
const GROK_INPUT_PER_1M = 0.2;
const GROK_OUTPUT_PER_1M = 0.5;
// GPT-5-mini: $0.25/1M input, $2.00/1M output. GPT-5-nano: $0.05/1M input, $0.40/1M output
const GPT_5_MINI_INPUT_PER_1M = 0.25;
const GPT_5_MINI_OUTPUT_PER_1M = 2.0;
const GPT_5_NANO_INPUT_PER_1M = 0.05;
const GPT_5_NANO_OUTPUT_PER_1M = 0.4;

const LOG_ARGS = {
  source: v.string(),
  provider: v.string(),
  inputTokens: v.number(),
  outputTokens: v.number(),
  model: v.optional(v.string()),
};

// Used internally from Convex actions/mutations
export const log = internalMutation({
  args: LOG_ARGS,
  handler: async (ctx, { source, provider, inputTokens, outputTokens, model }) => {
    let estimatedCostUsd = 0;
    if (provider === "grok") {
      estimatedCostUsd =
        (inputTokens / 1_000_000) * GROK_INPUT_PER_1M +
        (outputTokens / 1_000_000) * GROK_OUTPUT_PER_1M;
    } else if (provider === "gpt") {
      const isMini = model === "gpt-5-mini";
      estimatedCostUsd =
        (inputTokens / 1_000_000) * (isMini ? GPT_5_MINI_INPUT_PER_1M : GPT_5_NANO_INPUT_PER_1M) +
        (outputTokens / 1_000_000) * (isMini ? GPT_5_MINI_OUTPUT_PER_1M : GPT_5_NANO_OUTPUT_PER_1M);
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

// Used from Next.js server actions via ConvexHttpClient
export const logFromClient = mutation({
  args: LOG_ARGS,
  handler: async (ctx, args) => {
    await requireUserIdentity(ctx);
    await ctx.runMutation(internal.apiUsage.log, args);
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

function getISOWeek(ms: number): string {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    await requireUserIdentity(ctx);
    const all = await ctx.db.query("apiUsage").collect();
    const bySource: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }> = {};
    const byProvider: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }> = {};
    const byDay: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }> = {};
    const byWeek: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }> = {};
    let totalCalls = 0;
    let totalInput = 0;
    let totalOutput = 0;
    let totalCost = 0;

    for (const row of all) {
      const day = formatDate(row._creationTime);
      const week = getISOWeek(row._creationTime);
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

      if (!byProvider[row.provider]) {
        byProvider[row.provider] = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
      }
      byProvider[row.provider].calls++;
      byProvider[row.provider].inputTokens += row.inputTokens;
      byProvider[row.provider].outputTokens += row.outputTokens;
      byProvider[row.provider].costUsd += row.estimatedCostUsd;

      if (!byDay[day]) {
        byDay[day] = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
      }
      byDay[day].calls++;
      byDay[day].inputTokens += row.inputTokens;
      byDay[day].outputTokens += row.outputTokens;
      byDay[day].costUsd += row.estimatedCostUsd;

      if (!byWeek[week]) {
        byWeek[week] = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
      }
      byWeek[week].calls++;
      byWeek[week].inputTokens += row.inputTokens;
      byWeek[week].outputTokens += row.outputTokens;
      byWeek[week].costUsd += row.estimatedCostUsd;
    }

    const dailySorted = Object.entries(byDay).sort(([a], [b]) => b.localeCompare(a));
    const weeklySorted = Object.entries(byWeek).sort(([a], [b]) => b.localeCompare(a));

    const today = formatDate(Date.now());
    const gptTodayTotal = all
      .filter((r) => r.provider === "gpt" && formatDate(r._creationTime) === today)
      .reduce((sum, r) => sum + r.inputTokens + r.outputTokens, 0);

    return {
      overall: {
        calls: totalCalls,
        inputTokens: totalInput,
        outputTokens: totalOutput,
        costUsd: totalCost,
      },
      bySource,
      byProvider,
      byDay: dailySorted.map(([date, s]) => ({ date, ...s })),
      byWeek: weeklySorted.map(([week, s]) => ({ week, ...s })),
      gptTodayTotal,
    };
  },
});

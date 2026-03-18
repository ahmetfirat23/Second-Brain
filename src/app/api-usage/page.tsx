"use client";

import { api } from "../../../convex/_generated/api";
import { useQuery } from "convex/react";
import { BarChart3, Calendar, DollarSign, Layers } from "lucide-react";

function fmtTokens(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}
function fmtCost(n: number) {
  return n < 0.01 ? n.toFixed(4) : n.toFixed(2);
}

export default function ApiUsagePage() {
  const stats = useQuery(api.apiUsage.getStats);
  const recent = useQuery(api.apiUsage.list, { limit: 50 });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-emerald-900/30 flex items-center justify-center shrink-0">
            <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400" />
          </div>
          <h1 className="text-base sm:text-xl font-semibold text-white">API Usage</h1>
        </div>
        <p className="text-[10px] sm:text-xs text-[hsl(0_0%_68%)] mt-0.5 sm:mt-1 ml-8 sm:ml-11">
          Grok · GPT-5-nano · GPT-5-mini pricing
        </p>
      </div>

      {stats && (
        <div className="mb-6 bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_22%)] rounded-xl p-4">
          <p className="text-xs font-medium text-[hsl(0_0%_72%)] uppercase tracking-wider mb-1">OpenAI free quota — today</p>
          <p className="text-[11px] text-[hsl(0_0%_55%)] mb-2">
            {fmtTokens(stats.gptTodayTotal ?? 0)} / 2.5M tokens used ({(((stats.gptTodayTotal ?? 0) / 2_500_000) * 100).toFixed(1)}%)
          </p>
          <div className="h-2 bg-[hsl(0_0%_16%)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(((stats.gptTodayTotal ?? 0) / 2_500_000) * 100, 100)}%`,
                background: (stats.gptTodayTotal ?? 0) > 2_000_000 ? "hsl(0 72% 51%)" : (stats.gptTodayTotal ?? 0) > 1_500_000 ? "hsl(38 92% 50%)" : "hsl(142 71% 45%)",
              }}
            />
          </div>
        </div>
      )}

      {stats && stats.overall.calls > 0 && (
        <>
          <div className="mb-6">
            <h2 className="flex items-center gap-2 text-sm font-medium text-white mb-3">
              <Layers className="w-4 h-4 text-[hsl(0_0%_72%)]" /> Overall
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-[hsl(0_0%_34%)] bg-[hsl(0_0%_11%)] p-4">
                <p className="text-xs text-[hsl(0_0%_72%)] uppercase tracking-wider mb-1">Calls</p>
                <p className="text-2xl font-semibold text-white">{stats.overall.calls.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-[hsl(0_0%_34%)] bg-[hsl(0_0%_11%)] p-4">
                <p className="text-xs text-[hsl(0_0%_72%)] uppercase tracking-wider mb-1">Input tokens</p>
                <p className="text-2xl font-semibold text-white">{fmtTokens(stats.overall.inputTokens)}</p>
              </div>
              <div className="rounded-xl border border-[hsl(0_0%_34%)] bg-[hsl(0_0%_11%)] p-4">
                <p className="text-xs text-[hsl(0_0%_72%)] uppercase tracking-wider mb-1">Output tokens</p>
                <p className="text-2xl font-semibold text-white">{fmtTokens(stats.overall.outputTokens)}</p>
              </div>
              <div className="rounded-xl border border-[hsl(0_0%_34%)] bg-[hsl(0_0%_11%)] p-4">
                <p className="text-xs text-[hsl(0_0%_72%)] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> Est. cost
                </p>
                <p className="text-2xl font-semibold text-emerald-400">${fmtCost(stats.overall.costUsd)}</p>
              </div>
            </div>
          </div>

          {stats.byWeek && stats.byWeek.length > 0 && (
            <div className="rounded-xl border border-[hsl(0_0%_34%)] bg-[hsl(0_0%_11%)] overflow-hidden mb-6">
              <h2 className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-white border-b border-[hsl(0_0%_22%)]">
                <Calendar className="w-4 h-4 text-[hsl(0_0%_72%)]" /> Weekly
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[hsl(0_0%_72%)] border-b border-[hsl(0_0%_22%)]">
                      <th className="px-4 py-2 font-medium">Week</th>
                      <th className="px-4 py-2 font-medium">Calls</th>
                      <th className="px-4 py-2 font-medium">Input tokens</th>
                      <th className="px-4 py-2 font-medium">Output tokens</th>
                      <th className="px-4 py-2 font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byWeek.slice(0, 8).map(({ week, calls, inputTokens, outputTokens, costUsd }) => (
                      <tr key={week} className="border-b border-[hsl(0_0%_10%)] last:border-0">
                        <td className="px-4 py-2 text-white">{week}</td>
                        <td className="px-4 py-2 text-[hsl(0_0%_75%)]">{calls.toLocaleString()}</td>
                        <td className="px-4 py-2 text-[hsl(0_0%_72%)]">{fmtTokens(inputTokens)}</td>
                        <td className="px-4 py-2 text-[hsl(0_0%_72%)]">{fmtTokens(outputTokens)}</td>
                        <td className="px-4 py-2 text-emerald-400">${fmtCost(costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {stats.byDay.length > 0 && (
            <div className="rounded-xl border border-[hsl(0_0%_34%)] bg-[hsl(0_0%_11%)] overflow-hidden mb-8">
              <h2 className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-white border-b border-[hsl(0_0%_22%)]">
                <Calendar className="w-4 h-4 text-[hsl(0_0%_72%)]" /> Daily
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[hsl(0_0%_72%)] border-b border-[hsl(0_0%_22%)]">
                      <th className="px-4 py-2 font-medium">Date</th>
                      <th className="px-4 py-2 font-medium">Calls</th>
                      <th className="px-4 py-2 font-medium">Input tokens</th>
                      <th className="px-4 py-2 font-medium">Output tokens</th>
                      <th className="px-4 py-2 font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byDay.map(({ date, calls, inputTokens, outputTokens, costUsd }) => (
                      <tr key={date} className="border-b border-[hsl(0_0%_10%)] last:border-0">
                        <td className="px-4 py-2 text-white">{date}</td>
                        <td className="px-4 py-2 text-[hsl(0_0%_75%)]">{calls.toLocaleString()}</td>
                        <td className="px-4 py-2 text-[hsl(0_0%_72%)]">{fmtTokens(inputTokens)}</td>
                        <td className="px-4 py-2 text-[hsl(0_0%_72%)]">{fmtTokens(outputTokens)}</td>
                        <td className="px-4 py-2 text-emerald-400">${fmtCost(costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {stats && stats.byProvider && Object.keys(stats.byProvider).length > 0 && (
        <div className="rounded-xl border border-[hsl(0_0%_34%)] bg-[hsl(0_0%_11%)] overflow-hidden mb-8">
          <h2 className="px-4 py-3 text-sm font-medium text-white border-b border-[hsl(0_0%_22%)]">By provider</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[hsl(0_0%_72%)] border-b border-[hsl(0_0%_22%)]">
                  <th className="px-4 py-2 font-medium">Provider</th>
                  <th className="px-4 py-2 font-medium">Calls</th>
                  <th className="px-4 py-2 font-medium">Input tokens</th>
                  <th className="px-4 py-2 font-medium">Output tokens</th>
                  <th className="px-4 py-2 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.byProvider).map(([prov, s]) => (
                  <tr key={prov} className="border-b border-[hsl(0_0%_10%)] last:border-0">
                    <td className="px-4 py-2 text-white font-mono text-xs capitalize">{prov}</td>
                    <td className="px-4 py-2 text-[hsl(0_0%_75%)]">{s.calls.toLocaleString()}</td>
                    <td className="px-4 py-2 text-[hsl(0_0%_72%)]">{fmtTokens(s.inputTokens)}</td>
                    <td className="px-4 py-2 text-[hsl(0_0%_72%)]">{fmtTokens(s.outputTokens)}</td>
                    <td className="px-4 py-2 text-emerald-400">${fmtCost(s.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats && Object.keys(stats.bySource).length > 0 && (
        <div className="rounded-xl border border-[hsl(0_0%_34%)] bg-[hsl(0_0%_11%)] overflow-hidden mb-8">
          <h2 className="px-4 py-3 text-sm font-medium text-white border-b border-[hsl(0_0%_22%)]">By source</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[hsl(0_0%_72%)] border-b border-[hsl(0_0%_22%)]">
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Calls</th>
                  <th className="px-4 py-2 font-medium">Input tokens</th>
                  <th className="px-4 py-2 font-medium">Output tokens</th>
                  <th className="px-4 py-2 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.bySource).map(([source, s]) => (
                  <tr key={source} className="border-b border-[hsl(0_0%_10%)] last:border-0">
                    <td className="px-4 py-2 text-white font-mono text-xs">{source}</td>
                    <td className="px-4 py-2 text-[hsl(0_0%_75%)]">{s.calls.toLocaleString()}</td>
                    <td className="px-4 py-2 text-[hsl(0_0%_72%)]">{fmtTokens(s.inputTokens)}</td>
                    <td className="px-4 py-2 text-[hsl(0_0%_72%)]">{fmtTokens(s.outputTokens)}</td>
                    <td className="px-4 py-2 text-emerald-400">${fmtCost(s.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recent && recent.length > 0 && (
        <div className="rounded-xl border border-[hsl(0_0%_34%)] bg-[hsl(0_0%_11%)] overflow-hidden">
          <h2 className="px-4 py-3 text-sm font-medium text-white border-b border-[hsl(0_0%_22%)]">Recent calls</h2>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[hsl(0_0%_11%)]">
                <tr className="text-left text-[hsl(0_0%_72%)] border-b border-[hsl(0_0%_22%)]">
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium hidden sm:table-cell">Provider</th>
                  <th className="px-4 py-2 font-medium">Input</th>
                  <th className="px-4 py-2 font-medium">Output</th>
                  <th className="px-4 py-2 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row._id} className="border-b border-[hsl(0_0%_10%)] last:border-0">
                    <td className="px-4 py-1.5 text-white font-mono text-xs">{row.source}</td>
                    <td className="px-4 py-1.5 text-[hsl(0_0%_72%)] hidden sm:table-cell capitalize">{row.provider}</td>
                    <td className="px-4 py-1.5 text-[hsl(0_0%_72%)]">{row.inputTokens}</td>
                    <td className="px-4 py-1.5 text-[hsl(0_0%_72%)]">{row.outputTokens}</td>
                    <td className="px-4 py-1.5 text-emerald-400/90 text-xs">
                      ${row.estimatedCostUsd < 0.001 ? "<0.001" : row.estimatedCostUsd.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(!stats || stats.overall.calls === 0) && (!recent || recent.length === 0) && (
        <div className="rounded-xl border border-[hsl(0_0%_34%)] bg-[hsl(0_0%_11%)] p-8 text-center">
          <p className="text-sm text-[hsl(0_0%_72%)]">No API usage recorded yet.</p>
          <p className="text-xs text-[hsl(0_0%_64%)] mt-1">
            Usage is logged when you use the movie chat, brain dump AI, or taste summary.
          </p>
        </div>
      )}
    </div>
  );
}

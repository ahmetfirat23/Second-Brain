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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-900/30 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
          </div>
          <h1 className="text-xl font-semibold text-white">API Usage</h1>
        </div>
        <p className="text-sm text-[hsl(0_0%_45%)] ml-11">
          Grok (x.ai) — grok-4-1-fast-reasoning: $0.20/1M input, $0.50/1M output
        </p>
      </div>

      {stats && stats.overall.calls > 0 && (
        <>
          <div className="mb-6">
            <h2 className="flex items-center gap-2 text-sm font-medium text-white mb-3">
              <Layers className="w-4 h-4 text-[hsl(0_0%_45%)]" /> Overall
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-[hsl(0_0%_15%)] bg-[hsl(0_0%_8%)] p-4">
                <p className="text-xs text-[hsl(0_0%_45%)] uppercase tracking-wider mb-1">Calls</p>
                <p className="text-2xl font-semibold text-white">{stats.overall.calls.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-[hsl(0_0%_15%)] bg-[hsl(0_0%_8%)] p-4">
                <p className="text-xs text-[hsl(0_0%_45%)] uppercase tracking-wider mb-1">Input tokens</p>
                <p className="text-2xl font-semibold text-white">{fmtTokens(stats.overall.inputTokens)}</p>
              </div>
              <div className="rounded-xl border border-[hsl(0_0%_15%)] bg-[hsl(0_0%_8%)] p-4">
                <p className="text-xs text-[hsl(0_0%_45%)] uppercase tracking-wider mb-1">Output tokens</p>
                <p className="text-2xl font-semibold text-white">{fmtTokens(stats.overall.outputTokens)}</p>
              </div>
              <div className="rounded-xl border border-[hsl(0_0%_15%)] bg-[hsl(0_0%_8%)] p-4">
                <p className="text-xs text-[hsl(0_0%_45%)] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> Est. cost
                </p>
                <p className="text-2xl font-semibold text-emerald-400">${fmtCost(stats.overall.costUsd)}</p>
              </div>
            </div>
          </div>

          {stats.byDay.length > 0 && (
            <div className="rounded-xl border border-[hsl(0_0%_15%)] bg-[hsl(0_0%_8%)] overflow-hidden mb-8">
              <h2 className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-white border-b border-[hsl(0_0%_12%)]">
                <Calendar className="w-4 h-4 text-[hsl(0_0%_45%)]" /> Daily
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[hsl(0_0%_45%)] border-b border-[hsl(0_0%_12%)]">
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
                        <td className="px-4 py-2 text-[hsl(0_0%_65%)]">{fmtTokens(inputTokens)}</td>
                        <td className="px-4 py-2 text-[hsl(0_0%_65%)]">{fmtTokens(outputTokens)}</td>
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

      {stats && Object.keys(stats.bySource).length > 0 && (
        <div className="rounded-xl border border-[hsl(0_0%_15%)] bg-[hsl(0_0%_8%)] overflow-hidden mb-8">
          <h2 className="px-4 py-3 text-sm font-medium text-white border-b border-[hsl(0_0%_12%)]">By source</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[hsl(0_0%_45%)] border-b border-[hsl(0_0%_12%)]">
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
                    <td className="px-4 py-2 text-[hsl(0_0%_65%)]">{fmtTokens(s.inputTokens)}</td>
                    <td className="px-4 py-2 text-[hsl(0_0%_65%)]">{fmtTokens(s.outputTokens)}</td>
                    <td className="px-4 py-2 text-emerald-400">${fmtCost(s.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recent && recent.length > 0 && (
        <div className="rounded-xl border border-[hsl(0_0%_15%)] bg-[hsl(0_0%_8%)] overflow-hidden">
          <h2 className="px-4 py-3 text-sm font-medium text-white border-b border-[hsl(0_0%_12%)]">Recent calls</h2>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[hsl(0_0%_8%)]">
                <tr className="text-left text-[hsl(0_0%_45%)] border-b border-[hsl(0_0%_12%)]">
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Input</th>
                  <th className="px-4 py-2 font-medium">Output</th>
                  <th className="px-4 py-2 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row._id} className="border-b border-[hsl(0_0%_10%)] last:border-0">
                    <td className="px-4 py-1.5 text-white font-mono text-xs">{row.source}</td>
                    <td className="px-4 py-1.5 text-[hsl(0_0%_65%)]">{row.inputTokens}</td>
                    <td className="px-4 py-1.5 text-[hsl(0_0%_65%)]">{row.outputTokens}</td>
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
        <div className="rounded-xl border border-[hsl(0_0%_15%)] bg-[hsl(0_0%_8%)] p-8 text-center">
          <p className="text-sm text-[hsl(0_0%_45%)]">No API usage recorded yet.</p>
          <p className="text-xs text-[hsl(0_0%_35%)] mt-1">
            Usage is logged when you use the movie chat, brain dump AI, or taste summary.
          </p>
        </div>
      )}
    </div>
  );
}

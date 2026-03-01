import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUserIdentity } from "./auth";

export const globalSearch = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    await requireUserIdentity(ctx);
    if (!q.trim()) return [];
    const lower = q.toLowerCase();

    const [dumps, media, deadlines, vaultItems, cards, goals] = await Promise.all([
      ctx.db.query("brainDumps").take(200),
      ctx.db.query("mediaList").collect(),
      ctx.db.query("deadlines").collect(),
      ctx.db.query("vault").collect(),
      ctx.db.query("knowledgeCards").collect(),
      ctx.db.query("goals").collect(),
    ]);

    type Result = { id: string; title: string; subtitle: string; type: string; href: string };
    const results: Result[] = [];

    if (["api", "usage", "cost", "grok"].some((t) => lower.includes(t))) {
      results.push({ id: "api-usage", title: "API Usage", subtitle: "Monitor Grok API costs", type: "API Usage", href: "/api-usage" });
    }
    if (["daily", "todo", "today", "günlük", "yapılacak"].some((t) => lower.includes(t))) {
      results.push({ id: "daily-todos", title: "Daily Todos", subtitle: "Today's to-do list", type: "Daily Todos", href: "/daily-todos" });
    }

    dumps
      .filter((d) => d.content.toLowerCase().includes(lower))
      .slice(0, 5)
      .forEach((d) =>
        results.push({
          id: d._id,
          title: d.content.slice(0, 60) + (d.content.length > 60 ? "…" : ""),
          subtitle: new Date(d._creationTime).toLocaleDateString(),
          type: "Brain Dump",
          href: "/brain-dump",
        })
      );

    media
      .filter((m) => m.title.toLowerCase().includes(lower) || (m.notes ?? "").toLowerCase().includes(lower))
      .forEach((m) =>
        results.push({ id: m._id, title: m.title, subtitle: m.category, type: "Watch List", href: "/watch-list" })
      );

    deadlines
      .filter((d) => d.task.toLowerCase().includes(lower))
      .forEach((d) =>
        results.push({ id: d._id, title: d.task, subtitle: `${d.category} · ${d.deadline}`, type: "Tracker", href: "/tracker" })
      );

    vaultItems
      .filter((v) => v.title.toLowerCase().includes(lower) || v.url.toLowerCase().includes(lower))
      .forEach((v) =>
        results.push({ id: v._id, title: v.title, subtitle: v.url, type: "Vault", href: "/vault" })
      );

    cards
      .filter((c) => c.front.toLowerCase().includes(lower) || c.back.toLowerCase().includes(lower))
      .forEach((c) =>
        results.push({ id: c._id, title: c.front.slice(0, 60), subtitle: c.back.slice(0, 60), type: "Knowledge Base", href: "/knowledge-base" })
      );

    goals
      .filter((g) => g.title.toLowerCase().includes(lower) || (g.description ?? "").toLowerCase().includes(lower))
      .forEach((g) =>
        results.push({ id: g._id, title: g.title, subtitle: `${g.status.replace("_", " ")} · ${g.size}`, type: "Goals", href: "/goals" })
      );

    return results.slice(0, 20);
  },
});

"use server";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { parseBrainDump, tidyText } from "@/lib/grok";
import { searchTmdb } from "@/lib/tmdb";
import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/nextjs/server";

async function getConvex() {
  const authInstance = await auth();
  const token = await authInstance.getToken({ template: "convex" });
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  if (token) client.setAuth(token);
  return client;
}

async function logUsage(convex: ConvexHttpClient, source: string, provider: string, inputTokens: number, outputTokens: number, model?: string) {
  try {
    await convex.mutation(api.apiUsage.logFromClient, {
      source,
      provider,
      inputTokens,
      outputTokens,
      ...(provider === "gpt" && model && { model }),
    });
  } catch {
    /* ignore */
  }
}

export type TidyResult = {
  success: boolean;
  error?: string;
  summary?: {
    deadlines: number;
    media: number;
    knowledge_cards: number;
    vault: number;
    goals: number;
  };
};

export type TidyTextResult = {
  success: boolean;
  error?: string;
  title?: string;
  tidiedContent?: string;
};

export async function saveBrainDump(content: string, title?: string) {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Empty content");
  const convex = await getConvex();
  return convex.mutation(api.brainDumps.save, { content: trimmed, title: title?.trim() || undefined });
}

export async function tidyBrainDumpText(dumpId: string, content: string, title?: string): Promise<TidyTextResult> {
  try {
    const convex = await getConvex();
    const chatCtx = await convex.query(api.chatContext.getSettings, {});
    const provider = chatCtx?.aiProvider ?? "gpt";
    const model = chatCtx?.aiGptModel ?? "gpt-5-nano";
    if (provider === "gpt" && !process.env.OPENAI_API_KEY) return { success: false, error: "OPENAI_API_KEY not set in .env.local" };
    const { title: suggestedTitle, tidiedContent, usage } = await tidyText(content.trim(), title?.trim() || undefined, provider, model);
    if (usage) await logUsage(convex, "brain-dump-tidy", provider, usage.prompt_tokens, usage.completion_tokens, provider === "gpt" ? model : undefined);
    await convex.mutation(api.brainDumps.setTidied, {
      id: dumpId as Id<"brainDumps">,
      tidiedContent,
      title: suggestedTitle,
    });
    return { success: true, title: suggestedTitle, tidiedContent };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Tidy failed" };
  }
}

export async function fanOutDump(dumpId: string, content: string): Promise<TidyResult> {
  try {
    const convex = await getConvex();
    const chatCtx = await convex.query(api.chatContext.getSettings, {});
    const provider = chatCtx?.aiProvider ?? "gpt";
    const model = chatCtx?.aiGptModel ?? "gpt-5-nano";
    if (provider === "gpt" && !process.env.OPENAI_API_KEY) return { success: false, error: "OPENAI_API_KEY not set in .env.local" };
    const { parsed, usage } = await parseBrainDump(content, provider, model);
    if (usage) await logUsage(convex, "brain-dump-parse", provider, usage.prompt_tokens, usage.completion_tokens, provider === "gpt" ? model : undefined);

    // Enrich media with TMDB data (poster, overview, rating)
    const enrichedMedia = await Promise.all(
      parsed.media.map(async (m) => {
        const tmdb = await searchTmdb(m.title);
        return {
          title: m.title,
          category: m.category,
          notes: m.notes ?? undefined,
          ...(tmdb && {
            tmdbId: tmdb.tmdbId,
            posterPath: tmdb.posterPath ?? undefined,
            overview: tmdb.overview || undefined,
            voteAverage: tmdb.voteAverage,
          }),
        };
      })
    );

  const dumpIdTyped = dumpId as Id<"brainDumps">;

  await Promise.all([
    parsed.deadlines.length > 0 &&
      convex.mutation(api.deadlines.bulkCreate, {
        items: parsed.deadlines.map((d) => ({ ...d, sourceDumpId: dumpIdTyped })),
      }),
    enrichedMedia.length > 0 &&
      convex.mutation(api.mediaList.bulkCreate, {
        items: enrichedMedia.map((m) => ({ ...m, sourceDumpId: dumpIdTyped })),
      }).then((r) => r), // dupes silently skipped by bulkCreate
    parsed.knowledge_cards.length > 0 &&
      convex.mutation(api.knowledgeCards.bulkCreate, {
        items: parsed.knowledge_cards.map((k) => ({ ...k, sourceDumpId: dumpIdTyped })),
      }),
    parsed.vault.length > 0 &&
      convex.mutation(api.vault.bulkCreate, {
        items: parsed.vault.map((v) => {
          const title = (v.title ?? "").trim() || v.url.split("/").pop()?.split("?")[0] || "Untitled";
          return {
            title,
            url: v.url,
            urgency: Math.min(5, Math.max(1, v.urgency ?? 1)),
            sourceDumpId: dumpIdTyped,
          };
        }),
      }),
    parsed.goals.length > 0 &&
      convex.mutation(api.goals.bulkCreate, {
        items: parsed.goals.map((g) => ({
          title: g.title,
          description: g.description,
          importance: Math.min(5, Math.max(1, g.importance ?? 3)) as 1 | 2 | 3 | 4 | 5,
          size: g.size ?? "medium",
          sourceDumpId: dumpIdTyped,
        })),
      }),
  ]);

  await convex.mutation(api.brainDumps.markTidied, { id: dumpIdTyped });

  return {
    success: true,
    summary: {
      deadlines: parsed.deadlines.length,
      media: parsed.media.length,
      knowledge_cards: parsed.knowledge_cards.length,
      vault: parsed.vault.length,
      goals: parsed.goals.length,
    },
  };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Fan out failed" };
  }
}

export async function uncheckDump(dumpId: string): Promise<void> {
  const convex = await getConvex();
  await convex.mutation(api.brainDumps.uncheck, { id: dumpId as Id<"brainDumps"> });
}

export async function updateDumpAndReGroup(
  dumpId: string,
  content: string,
  title?: string
): Promise<TidyResult> {
  const id = dumpId as Id<"brainDumps">;
  try {
    const convex = await getConvex();
    await Promise.all([
      convex.mutation(api.deadlines.removeBySourceDumpId, { sourceDumpId: id }),
      convex.mutation(api.mediaList.removeBySourceDumpId, { sourceDumpId: id }),
      convex.mutation(api.knowledgeCards.removeBySourceDumpId, { sourceDumpId: id }),
      convex.mutation(api.vault.removeBySourceDumpId, { sourceDumpId: id }),
      convex.mutation(api.goals.removeBySourceDumpId, { sourceDumpId: id }),
    ]);
    await convex.mutation(api.brainDumps.update, {
      id,
      content: content.trim(),
      tidiedContent: content.trim(),
      title: title?.trim() || undefined,
    });
    return fanOutDump(dumpId, content.trim());
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Update & re-group failed" };
  }
}

export async function tidyAllPending(): Promise<{
  processed: number;
  totalAdded: TidyResult["summary"];
  errors: number;
}> {
  const convex = await getConvex();
  const pending = await convex.query(api.brainDumps.getPending, {});

  let errors = 0;
  const totalAdded = { deadlines: 0, media: 0, knowledge_cards: 0, vault: 0, goals: 0 };

  for (const dump of pending) {
    try {
      const result = await fanOutDump(dump._id, dump.content);
      if (result.success && result.summary) {
        totalAdded.deadlines += result.summary.deadlines;
        totalAdded.media += result.summary.media;
        totalAdded.knowledge_cards += result.summary.knowledge_cards;
        totalAdded.vault += result.summary.vault;
        totalAdded.goals += result.summary.goals;
      } else {
        errors++;
      }
    } catch {
      errors++;
    }
  }

  return { processed: pending.length - errors, totalAdded, errors };
}

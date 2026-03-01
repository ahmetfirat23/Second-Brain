"use server";

import { api } from "../../convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

async function logGrokUsage(
  source: string,
  inputTokens: number,
  outputTokens: number
) {
  try {
    await convex.mutation(api.apiUsage.log, {
      source,
      provider: "grok",
      inputTokens,
      outputTokens,
    });
  } catch {
    /* ignore logging errors */
  }
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `You are a friendly movie & TV show buddy. The user has a personal watch list and may have shared notes about themselves. Use their watch list, watched history with opinions/ratings, and personal notes to tailor recommendations.

1. First check their watch list. If something fits their mood or request, recommend from their list and say why.
2. Use their watched items (with opinions and ratings) to understand their taste — recommend similar things or avoid what they disliked.
3. If nothing on their list fits, or the list is empty, suggest 1–2 things you think they'd like based on their taste. Be brief, no spoilers.
4. Keep replies short (2–4 sentences). Conversational, like chatting with a friend.
5. You can discuss, debate, or narrow down based on follow-ups (genre, mood, length, etc.).
6. Reply in the same language the user uses (Turkish or English).`;

export async function sendMovieChatMessage(
  userMessage: string,
  history: ChatMessage[]
): Promise<{ content: string; error?: string }> {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) return { content: "", error: "GROK_API_KEY is not set in .env.local" };

  const [watchList, tasteSummary, chatCtx] = await Promise.all([
    convex.query(api.mediaList.list, {}),
    convex.query(api.tasteSummary.get, {}),
    convex.query(api.chatContext.getSettings, {}),
  ]);

  const toWatch = watchList.filter((m) => !m.watchedAt);
  const watched = watchList.filter((m) => !!m.watchedAt);
  const autoIncludeEnabled = chatCtx?.autoIncludeEnabled ?? false;
  const includeRatings = chatCtx?.includeRatings ?? true;
  const useLimitMode = chatCtx?.useLimitMode ?? false;

  let toInclude: typeof watched = [];
  if (autoIncludeEnabled && watched.length > 0) {
    if (useLimitMode) {
      const withReviews = watched.filter((m) => m.watchedNotes?.trim());
      toInclude = withReviews.slice(-15);
    } else {
      toInclude = watched;
    }
  }

  const counts = `To watch: ${toWatch.length}. Watched: ${watched.length}.`;
  const listTitles = toWatch.length > 0 ? toWatch.map((m) => m.title).join(", ") : "(empty)";

  const contextParts: string[] = [
    `[Counts] ${counts}`,
    `[Watch list titles] ${listTitles}`,
  ];

  if (tasteSummary?.summary) {
    contextParts.push(`[User's taste summary — use to personalize]\n${tasteSummary.summary}`);
  }

  if (toInclude.length > 0) {
    const watchedText = toInclude
      .map((m) => {
        const parts = [`- ${m.title} (${m.category})`];
        if (includeRatings && m.userRating !== undefined && m.userRating > 0) {
          const r = m.userRating <= 5 ? m.userRating * 2 : m.userRating;
          parts.push(`rated ${(r / 2).toFixed(1)}/5`);
        }
        if (m.watchedNotes?.trim()) parts.push(`— ${m.watchedNotes}`);
        return parts.join(" ");
      })
      .join("\n");
    contextParts.push(`[User's watched history — use to understand their taste]\n${watchedText}`);
  }

  const context = contextParts.join("\n\n");

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\n${context}` },
    ...history.slice(-8).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userMessage },
  ];

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "grok-4-1-fast-reasoning",
      messages,
      temperature: 0.7,
      max_tokens: 256,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { content: "", error: `Grok error: ${err}` };
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices[0]?.message?.content?.trim() ?? "";
  const usage = data.usage;
  if (usage?.prompt_tokens != null && usage?.completion_tokens != null) {
    await logGrokUsage("movie-chat", usage.prompt_tokens, usage.completion_tokens);
  }

  return { content };
}

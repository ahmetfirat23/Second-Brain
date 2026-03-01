"use server";

import { api } from "../../convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/nextjs/server";

async function getConvex() {
  const authInstance = await auth();
  const token = await authInstance.getToken({ template: "convex" });
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  if (token) client.setAuth(token);
  return client;
}

async function logUsage(
  convex: ConvexHttpClient,
  source: string,
  provider: string,
  inputTokens: number,
  outputTokens: number,
  model?: string
) {
  try {
    await convex.mutation(api.apiUsage.log, {
      source,
      provider,
      inputTokens,
      outputTokens,
      ...(provider === "gpt" && model && { model }),
    });
  } catch {
    /* ignore logging errors */
  }
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `You are a friendly movie & TV show buddy. The user has two separate lists:
- TO-WATCH LIST: titles they HAVE NOT seen yet and want to watch in the future.
- ALREADY WATCHED: titles they HAVE already seen, with optional ratings and personal reviews.

Rules:
1. When recommending what to watch NEXT, always check the TO-WATCH LIST first — if something there fits, recommend it and say why.
2. If nothing on the TO-WATCH LIST fits well, freely suggest 1–2 new titles you think they'd enjoy based on their taste and watched history.
3. Use ALREADY WATCHED items (ratings + reviews) to understand taste. NEVER recommend something from that list as if they haven't seen it yet.
4. Keep replies short (2–4 sentences). Conversational, like chatting with a friend.
5. You can discuss, debate, or narrow down based on follow-ups (genre, mood, length, etc.).
6. Reply in the same language the user uses (Turkish or English).`;

export async function sendMovieChatMessage(
  userMessage: string,
  history: ChatMessage[],
  filterCategory?: string
): Promise<{ content: string; error?: string }> {
  const convex = await getConvex();
  const [watchList, tasteSummary, chatCtx] = await Promise.all([
    convex.query(api.mediaList.list, {}),
    convex.query(api.tasteSummary.get, {}),
    convex.query(api.chatContext.getSettings, {}),
  ]);

  const provider = chatCtx?.aiProvider ?? "gpt"; // Default: "gpt" — change to "grok" to revert
  const model = chatCtx?.aiGptModel ?? "gpt-5-nano";

  if (provider === "gpt") {
    if (!process.env.OPENAI_API_KEY) return { content: "", error: "OPENAI_API_KEY is not set in .env.local. Add it to use GPT." };
  } else {
    if (!process.env.GROK_API_KEY) return { content: "", error: "GROK_API_KEY is not set in .env.local" };
  }

  const filteredList = filterCategory
    ? watchList.filter((m) => m.category === filterCategory)
    : watchList;

  const toWatch = filteredList.filter((m) => !m.watchedAt);
  const watched = filteredList.filter((m) => !!m.watchedAt);
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

  const filterNote = filterCategory ? ` (filtered to ${filterCategory} only)` : "";
  const listTitles = toWatch.length > 0 ? toWatch.map((m) => m.title).join(", ") : "(empty)";

  const contextParts: string[] = [
    `[SUMMARY] TO-WATCH (not yet seen): ${toWatch.length}${filterNote}. ALREADY WATCHED: ${watched.length}.`,
    `[TO-WATCH LIST — titles the user HAS NOT seen yet, available to recommend]\n${listTitles}`,
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
    contextParts.push(`[ALREADY WATCHED — use ONLY to understand taste, NOT to recommend as unwatched]\n${watchedText}`);
  }

  const context = contextParts.join("\n\n");

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\n${context}` },
    ...history.slice(-8).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userMessage },
  ];

  const isGpt = provider === "gpt";
  const url = isGpt ? "https://api.openai.com/v1/chat/completions" : "https://api.x.ai/v1/chat/completions";
  const apiKey = isGpt ? process.env.OPENAI_API_KEY! : process.env.GROK_API_KEY!;
  const body = isGpt
    ? { model, messages, max_completion_tokens: 2048, reasoning_effort: "low" }
    : { model: "grok-4-1-fast-reasoning", messages, temperature: 0.7, max_tokens: 1024 };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    return { content: "", error: `${isGpt ? "OpenAI" : "Grok"} error: ${err}` };
  }

  const data = (await res.json()) as {
    choices: { message: { content: string | null; refusal?: string | null } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices[0]?.message?.content?.trim() ?? "";
  const usage = data.usage;
  if (usage?.prompt_tokens != null && usage?.completion_tokens != null) {
    await logUsage(convex, "movie-chat", provider, usage.prompt_tokens, usage.completion_tokens, isGpt ? model : undefined);
  }

  return { content };
}

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { requireUserIdentity } from "./auth";
import type { Id } from "./_generated/dataModel";

const PROPOSE_TOPICS_SYSTEM = `You are a knowledge card organizer. Analyze all flashcards and propose the MINIMUM number of broad topic categories needed — like Anki deck names, not tags. Target 3-5 topics maximum. Aggressively consolidate: related subjects belong in one topic (e.g., all U.S. politics, elections, government, ideology, parties → "U.S. Politics"). Topics must be broad enough that each covers many cards. Never create a topic for a single person's name or a narrow subtopic — group them under the broader field instead.

Good examples: "Mathematics", "U.S. Politics", "Computer Science", "History", "Physics".
Bad examples (too specific — do NOT use): "Pseudoinverse Basics", "John Carmack", "Democratic Ideology", "Elections System", "Game Technology".

Return ONLY valid JSON: { "topics": ["Topic A", "Topic B"] }`;

const ASSIGN_TOPICS_SYSTEM = `You are a knowledge card organizer. Assign each card to exactly one topic from the provided list. Topics are broad subjects like Anki decks — assign to the best-fitting general category. Do not create new topics.

Return ONLY valid JSON: { "assignments": [{ "id": "card_id", "topic": "Topic Name" }] }`;

const ASSIGN_INCREMENTAL_SYSTEM = `You are a knowledge card organizer. Assign each uncategorized card to the most fitting topic from the provided list. Topics are broad subjects like Anki decks. Prefer existing topics strongly; only create a new topic if no existing one fits at all.

Return ONLY valid JSON: { "assignments": [{ "id": "card_id", "topic": "Topic Name" }] }`;

type ParsedBrainDump = {
  deadlines: { task: string; deadline: string; category: "Job" | "Lecture" | "Other" }[];
  media: { title: string; category: "Sitcom" | "Anime" | "Film" | "Documentary" | "Series" | "Other"; notes?: string }[];
  knowledge_cards: { front: string; back: string }[];
  vault: { title: string; url: string; urgency: number }[];
  goals: { title: string; description?: string; importance: number; size: "short" | "medium" | "long" }[];
};

const FAN_OUT_SYSTEM = `You are a structured data extractor. Parse the user's brain dump text and extract items into JSON.

Return ONLY valid JSON with this exact shape:
{
  "deadlines": [{"task": "...", "deadline": "YYYY-MM-DD", "category": "Job|Lecture|Other"}],
  "media": [{"title": "...", "category": "Sitcom|Anime|Film|Documentary|Series|Other", "notes": "optional"}],
  "knowledge_cards": [{"front": "...", "back": "..."}],
  "vault": [{"title": "...", "url": "https://...", "urgency": 1-5}],
  "goals": [{"title": "...", "description": "optional", "importance": 1-5, "size": "short|medium|long"}]
}

Rules:
- Only extract items clearly mentioned. Do not infer.
- deadlines: must have a specific date or relative date you can compute from today
- media: TV shows, movies, anime to watch
- knowledge_cards: facts, CS concepts, formulas to remember
- vault: URLs/links mentioned
- goals: things to do, objectives, resolutions, habits to build. importance 1-5 (5=most important). size: short (quick task), medium (project), long (big goal)
- If nothing fits a category, return an empty array for it`;

const TIDY_SYSTEM = `You are a personal note editor. Your job is to rewrite the user's rough note into a clean, concise version.

Rules:
- Keep it SHORT and NON-VERBOSE. Remove filler words and redundancy.
- Preserve all information — do not drop anything important.
- Use clear sentences or bullet points where appropriate.
- If no title is given (or the title field is empty), suggest a short, specific title (max 6 words).
- Return ONLY valid JSON: { "title": "...", "tidiedContent": "..." }`;

type AiUsage = { prompt_tokens: number; completion_tokens: number };

async function callGrok(systemPrompt: string, userContent: string, options?: { maxTokens?: number }): Promise<{ content: string; usage?: AiUsage }> {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) throw new Error("GROK_API_KEY not set in Convex environment");

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "grok-4-1-fast-reasoning",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.1,
      max_tokens: options?.maxTokens ?? 4096,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Grok API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices[0]?.message?.content ?? "{}";
  const usage =
    data.usage?.prompt_tokens != null && data.usage?.completion_tokens != null
      ? { prompt_tokens: data.usage.prompt_tokens, completion_tokens: data.usage.completion_tokens }
      : undefined;
  return { content, usage };
}

async function callGpt(systemPrompt: string, userContent: string, model: "gpt-5-mini" | "gpt-5-nano", options?: { maxTokens?: number; reasoningEffort?: "low" | "medium" | "high" }): Promise<{ content: string; usage?: AiUsage }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set in Convex environment");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_completion_tokens: options?.maxTokens ?? 2048,
      reasoning_effort: options?.reasoningEffort ?? "low",
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices[0]?.message?.content ?? "{}";
  const usage =
    data.usage?.prompt_tokens != null && data.usage?.completion_tokens != null
      ? { prompt_tokens: data.usage.prompt_tokens, completion_tokens: data.usage.completion_tokens }
      : undefined;
  return { content, usage };
}

async function searchTmdb(title: string): Promise<{
  tmdbId: number;
  tmdbMediaType: string;
  posterPath: string | null;
  overview: string;
  voteAverage: number;
  genres?: string[];
  director?: string;
} | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  const url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(title)}&include_adult=false&language=en-US&page=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, accept: "application/json" },
  });
  if (!res.ok) return null;

  type TmdbRaw = { id: number; media_type: string; title?: string; name?: string; poster_path?: string; overview?: string; vote_average?: number };
  const data = (await res.json()) as { results: TmdbRaw[] };
  const match = data.results?.find((r) => r.media_type === "movie" || r.media_type === "tv");
  if (!match) return null;

  const mediaType = match.media_type === "tv" ? "tv" : "movie";
  let genres: string[] | undefined;
  let director: string | undefined;

  const detailUrl = `https://api.themoviedb.org/3/${mediaType}/${match.id}?language=en-US&append_to_response=credits`;
  const detailRes = await fetch(detailUrl, {
    headers: { Authorization: `Bearer ${apiKey}`, accept: "application/json" },
  });
  if (detailRes.ok) {
    type Genre = { id: number; name: string };
    type Crew = { job: string; name: string };
    const detail = (await detailRes.json()) as { genres?: Genre[]; credits?: { crew?: Crew[] } };
    genres = detail.genres?.map((g) => g.name);
    director = detail.credits?.crew?.find((c) => c.job === "Director")?.name;
  }

  return {
    tmdbId: match.id,
    tmdbMediaType: mediaType,
    posterPath: match.poster_path ? `https://image.tmdb.org/t/p/w200${match.poster_path}` : null,
    overview: match.overview ?? "",
    voteAverage: Math.round((match.vote_average ?? 0) * 10) / 10,
    genres,
    director,
  };
}

// Tidy a note: returns cleaned text + suggested title
export const tidyText = action({
  args: { content: v.string(), title: v.optional(v.string()) },
  handler: async (ctx, { content, title }): Promise<{ title: string; tidiedContent: string }> => {
    await requireUserIdentity(ctx);
    const settings = await ctx.runQuery(api.chatContext.getSettings, {});
    const provider = settings.aiProvider ?? "gpt" // Default: "gpt" — change to "grok" to revert;
    const model = settings.aiGptModel ?? "gpt-5-nano";
    const userContent = title ? `Title: ${title}\n\n${content}` : content;

    let raw: string;
    let usage: AiUsage | undefined;
    if (provider === "gpt") {
      const result = await callGpt(TIDY_SYSTEM, userContent, model);
      raw = result.content;
      usage = result.usage;
    } else {
      const result = await callGrok(TIDY_SYSTEM, userContent);
      raw = result.content;
      usage = result.usage;
    }

    if (usage) {
      await ctx.runMutation(api.apiUsage.log, {
        source: "ai-tidy",
        provider,
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        ...(provider === "gpt" && { model }),
      });
    }
    const parsed = JSON.parse(raw) as { title?: string; tidiedContent?: string };
    return {
      title: parsed.title ?? title ?? "Untitled",
      tidiedContent: parsed.tidiedContent ?? content,
    };
  },
});

// Fan-out: extract structured items from a dump and distribute to modules
export const fanOutDump = action({
  args: { dumpId: v.id("brainDumps"), content: v.string() },
  handler: async (ctx, { dumpId, content }): Promise<{
    success: boolean;
    error?: string;
    summary?: { deadlines: number; media: number; knowledge_cards: number; vault: number; goals: number };
  }> => {
    await requireUserIdentity(ctx);
    const settings = await ctx.runQuery(api.chatContext.getSettings, {});
    const provider = settings.aiProvider ?? "gpt" // Default: "gpt" — change to "grok" to revert;
    const model = settings.aiGptModel ?? "gpt-5-nano";

    let raw: string;
    let usage: AiUsage | undefined;
    if (provider === "gpt") {
      const result = await callGpt(FAN_OUT_SYSTEM, content, model, { maxTokens: 2048 });
      raw = result.content;
      usage = result.usage;
    } else {
      const result = await callGrok(FAN_OUT_SYSTEM, content, { maxTokens: 2048 });
      raw = result.content;
      usage = result.usage;
    }

    if (usage) {
      await ctx.runMutation(api.apiUsage.log, {
        source: "ai-fanout",
        provider,
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        ...(provider === "gpt" && { model }),
      });
    }
    const parsed = JSON.parse(raw) as Partial<ParsedBrainDump>;
    const result: ParsedBrainDump = {
      deadlines: parsed.deadlines ?? [],
      media: parsed.media ?? [],
      knowledge_cards: parsed.knowledge_cards ?? [],
      vault: parsed.vault ?? [],
      goals: parsed.goals ?? [],
    };

    // Enrich media with TMDB (poster, overview, rating)
    const enrichedMedia = await Promise.all(
      result.media.map(async (m) => {
        const tmdb = await searchTmdb(m.title);
        return {
          title: m.title,
          category: m.category,
          notes: m.notes ?? undefined,
          ...(tmdb && {
            tmdbId: tmdb.tmdbId,
            tmdbMediaType: tmdb.tmdbMediaType,
            posterPath: tmdb.posterPath ?? undefined,
            overview: tmdb.overview || undefined,
            voteAverage: tmdb.voteAverage,
            genres: tmdb.genres,
            director: tmdb.director,
          }),
        };
      })
    );

    await Promise.all([
      result.deadlines.length > 0 && ctx.runMutation(api.deadlines.bulkCreate, {
        items: result.deadlines.map((d) => ({ ...d, sourceDumpId: dumpId })),
      }),
      enrichedMedia.length > 0 && ctx.runMutation(api.mediaList.bulkCreate, {
        items: enrichedMedia.map((m) => ({ ...m, sourceDumpId: dumpId })),
      }),
      result.knowledge_cards.length > 0 && ctx.runMutation(api.knowledgeCards.bulkCreate, {
        items: result.knowledge_cards.map((k) => ({ ...k, sourceDumpId: dumpId })),
      }),
      result.vault.length > 0 && ctx.runMutation(api.vault.bulkCreate, {
        items: result.vault.map((v) => {
          const title = (v.title ?? "").trim() || v.url.split("/").pop()?.split("?")[0] || "Untitled";
          return { title, url: v.url, urgency: Math.min(5, Math.max(1, v.urgency ?? 1)), sourceDumpId: dumpId };
        }),
      }),
      result.goals.length > 0 && ctx.runMutation(api.goals.bulkCreate, {
        items: result.goals.map((g) => ({
          title: g.title,
          description: g.description,
          importance: Math.min(5, Math.max(1, g.importance ?? 3)) as 1 | 2 | 3 | 4 | 5,
          size: g.size ?? "medium",
          sourceDumpId: dumpId,
        })),
      }),
    ]);

    await ctx.runMutation(api.brainDumps.markTidied, { id: dumpId });

    return {
      success: true,
      summary: {
        deadlines: result.deadlines.length,
        media: result.media.length,
        knowledge_cards: result.knowledge_cards.length,
        vault: result.vault.length,
        goals: result.goals.length,
      },
    };
  },
});

const TASTE_SUMMARY_SYSTEM = `You are a taste analyst. Given the user's watched media (with ratings and opinions) and their personal notes, write a SHORT summary (2-4 sentences, max 150 words) capturing:
- Genres and types they enjoy
- What they tend to dislike
- Any specific preferences (mood, length, style)
- Key themes from their notes that relate to media taste

Be concise. This summary will be used by a movie recommendation chatbot to personalize suggestions.
Return ONLY valid JSON: { "summary": "your summary text here" }`;

// Internal cron: generate taste summary weekly
export const generateTasteSummaryCron = internalAction({
  args: {},
  handler: async (ctx) => {
    const result = await ctx.runAction(api.ai.generateTasteSummary, {});
    console.log("[cron] Taste summary:", result.success ? "updated" : result.error);
  },
});

// Generate and store taste summary from watched items + brain dumps
export const generateTasteSummary = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; summary?: string; error?: string }> => {
    await requireUserIdentity(ctx);
    const [watchList, brainDumps] = await Promise.all([
      ctx.runQuery(api.mediaList.list, {}),
      ctx.runQuery(api.brainDumps.list, {}),
    ]);
    type WatchedItem = { title: string; category: string; userRating?: number; watchedNotes?: string };
    const watched = watchList.filter((m: { watchedAt?: string }) => !!m.watchedAt) as WatchedItem[];
    const watchedText =
      watched.length > 0
        ? watched
            .map((m: WatchedItem) => {
              const parts = [`${m.title} (${m.category})`];
              if (m.userRating !== undefined && m.userRating > 0) {
                const r = m.userRating <= 5 ? m.userRating * 2 : m.userRating;
                parts.push(`rated ${(r / 2).toFixed(1)}/5`);
              }
              if (m.watchedNotes) parts.push(`— ${m.watchedNotes}`);
              return parts.join(" ");
            })
            .join("\n")
        : "(No watched items yet)";
    const dumpsText =
      brainDumps.length > 0
        ? brainDumps
            .slice(0, 20)
            .map((d: { tidiedContent?: string; content: string }) => (d.tidiedContent ?? d.content).slice(0, 150))
            .join("\n")
        : "(No personal notes)";
    const userContent = `[Watched items]\n${watchedText}\n\n[Personal notes]\n${dumpsText}`;
    try {
      const settings = await ctx.runQuery(api.chatContext.getSettings, {});
      const provider = settings.aiProvider ?? "gpt" // Default: "gpt" — change to "grok" to revert;
      const model = settings.aiGptModel ?? "gpt-5-nano";

      let raw: string;
      let usage: AiUsage | undefined;
      if (provider === "gpt") {
        const result = await callGpt(TASTE_SUMMARY_SYSTEM, userContent, model, { maxTokens: 4096, reasoningEffort: "low" });
        raw = result.content;
        usage = result.usage;
      } else {
        const result = await callGrok(TASTE_SUMMARY_SYSTEM, userContent, { maxTokens: 4096 });
        raw = result.content;
        usage = result.usage;
      }

      if (usage) {
        await ctx.runMutation(api.apiUsage.log, {
          source: "ai-taste",
          provider,
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          ...(provider === "gpt" && { model }),
        });
      }
      if (!raw?.trim()) throw new Error("AI returned empty response — try again");
      const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      let summary: string;
      try {
        const parsed = JSON.parse(jsonStr) as { summary?: string };
        summary = (parsed.summary ?? jsonStr).trim().slice(0, 3000);
      } catch {
        // Model returned plain text instead of JSON — use it directly
        summary = jsonStr.slice(0, 3000);
      }
      await ctx.runMutation(api.tasteSummary.set, {
        summary,
        updatedAt: new Date().toISOString(),
      });
      return { success: true, summary };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },
});

// Internal cron: fan-out all pending (non-standalone) dumps. Uses Grok (no user context in cron).
export const tidyAllPending = internalAction({
  args: {},
  handler: async (ctx) => {
    const pending: { _id: Id<"brainDumps">; content: string; tidiedAt?: string }[] =
      await ctx.runQuery(api.brainDumps.getPending, {});
    let processed = 0;
    let errors = 0;
    for (const dump of pending) {
      try {
        const { content: raw, usage } = await callGrok(FAN_OUT_SYSTEM, dump.content, { maxTokens: 2048 });
        if (usage) {
          await ctx.runMutation(api.apiUsage.log, {
            source: "ai-tidy-all",
            provider: "grok",
            inputTokens: usage.prompt_tokens,
            outputTokens: usage.completion_tokens,
          });
        }
        const parsed = JSON.parse(raw) as Partial<ParsedBrainDump>;
        const result: ParsedBrainDump = {
          deadlines: parsed.deadlines ?? [],
          media: parsed.media ?? [],
          knowledge_cards: parsed.knowledge_cards ?? [],
          vault: parsed.vault ?? [],
          goals: parsed.goals ?? [],
        };

        const enrichedMedia = await Promise.all(
          result.media.map(async (m) => {
            const tmdb = await searchTmdb(m.title);
            return {
              title: m.title,
              category: m.category,
              notes: m.notes ?? undefined,
              ...(tmdb && {
                tmdbId: tmdb.tmdbId,
                tmdbMediaType: tmdb.tmdbMediaType,
                posterPath: tmdb.posterPath ?? undefined,
                overview: tmdb.overview || undefined,
                voteAverage: tmdb.voteAverage,
                genres: tmdb.genres,
                director: tmdb.director,
              }),
            };
          })
        );

        await Promise.all([
          result.deadlines.length > 0 && ctx.runMutation(api.deadlines.bulkCreate, {
            items: result.deadlines.map((d) => ({ ...d, sourceDumpId: dump._id })),
          }),
          enrichedMedia.length > 0 && ctx.runMutation(api.mediaList.bulkCreate, {
            items: enrichedMedia.map((m) => ({ ...m, sourceDumpId: dump._id })),
          }),
          result.knowledge_cards.length > 0 && ctx.runMutation(api.knowledgeCards.bulkCreate, {
            items: result.knowledge_cards.map((k) => ({ ...k, sourceDumpId: dump._id })),
          }),
          result.vault.length > 0 && ctx.runMutation(api.vault.bulkCreate, {
            items: result.vault.map((v) => {
              const title = (v.title ?? "").trim() || v.url.split("/").pop()?.split("?")[0] || "Untitled";
              return { title, url: v.url, urgency: Math.min(5, Math.max(1, v.urgency ?? 1)), sourceDumpId: dump._id };
            }),
          }),
          result.goals.length > 0 && ctx.runMutation(api.goals.bulkCreate, {
            items: result.goals.map((g) => ({
              title: g.title,
              description: g.description,
              importance: Math.min(5, Math.max(1, g.importance ?? 3)) as 1 | 2 | 3 | 4 | 5,
              size: g.size ?? "medium",
              sourceDumpId: dump._id,
            })),
          }),
        ]);
        await ctx.runMutation(api.brainDumps.markTidied, { id: dump._id });
        processed++;
      } catch {
        errors++;
      }
    }
    console.log(`[cron] Fan-out: ${processed} processed, ${errors} errors`);
  },
});

// ─── Knowledge card topic categorization ──────────────────────────────────────

export const proposeTopics = action({
  args: {},
  handler: async (ctx): Promise<{ topics: string[] }> => {
    await requireUserIdentity(ctx);
    const allCards = await ctx.runQuery(api.knowledgeCards.list, {});
    if (allCards.length === 0) return { topics: [] };

    const cardsText = allCards
      .slice(0, 150)
      .map((c) => `Q: ${c.front.slice(0, 120)} | A: ${c.back.slice(0, 120)}`)
      .join("\n");

    const settings = await ctx.runQuery(api.chatContext.getSettings, {});
    const provider = settings.aiProvider ?? "gpt";
    const model = settings.aiGptModel ?? "gpt-5-nano";

    let raw: string;
    let usage: AiUsage | undefined;
    if (provider === "gpt") {
      const result = await callGpt(PROPOSE_TOPICS_SYSTEM, cardsText, model, { maxTokens: 512 });
      raw = result.content; usage = result.usage;
    } else {
      const result = await callGrok(PROPOSE_TOPICS_SYSTEM, cardsText, { maxTokens: 512 });
      raw = result.content; usage = result.usage;
    }

    if (usage) {
      await ctx.runMutation(api.apiUsage.log, {
        source: "ai-topics-propose", provider,
        inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens,
        ...(provider === "gpt" && { model }),
      });
    }

    const parsed = JSON.parse(raw.trim() || "{}") as { topics?: string[] };
    return { topics: parsed.topics ?? [] };
  },
});

export const assignCardsToTopics = action({
  args: {
    topics: v.array(v.string()),
    mode: v.union(v.literal("scratch"), v.literal("incremental")),
  },
  handler: async (ctx, { topics, mode }): Promise<{ assigned: number }> => {
    await requireUserIdentity(ctx);
    const allCards = await ctx.runQuery(api.knowledgeCards.list, {});

    let cardsToAssign = allCards;
    let topicList = topics;

    if (mode === "scratch") {
      await ctx.runMutation(api.knowledgeCards.clearAllTopics, {});
    } else {
      cardsToAssign = allCards.filter((c) => !c.topic);
      const cardTopics = [...new Set(allCards.map((c) => c.topic).filter(Boolean))] as string[];
      topicList = [...new Set([...cardTopics, ...topics])];
    }

    if (cardsToAssign.length === 0) return { assigned: 0 };

    const systemPrompt = mode === "scratch" ? ASSIGN_TOPICS_SYSTEM : ASSIGN_INCREMENTAL_SYSTEM;
    const topicsSection = topicList.length > 0 ? `Topics: ${topicList.join(", ")}\n\n` : "";
    const cardsText = topicsSection + "Cards:\n" + cardsToAssign
      .map((c) => JSON.stringify({ id: c._id, q: c.front.slice(0, 100), a: c.back.slice(0, 100) }))
      .join("\n");

    const settings = await ctx.runQuery(api.chatContext.getSettings, {});
    const provider = settings.aiProvider ?? "gpt";
    const model = settings.aiGptModel ?? "gpt-5-nano";

    let raw: string;
    let usage: AiUsage | undefined;
    if (provider === "gpt") {
      const result = await callGpt(systemPrompt, cardsText, model, { maxTokens: 2048 });
      raw = result.content; usage = result.usage;
    } else {
      const result = await callGrok(systemPrompt, cardsText, { maxTokens: 2048 });
      raw = result.content; usage = result.usage;
    }

    if (usage) {
      await ctx.runMutation(api.apiUsage.log, {
        source: "ai-topics-assign", provider,
        inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens,
        ...(provider === "gpt" && { model }),
      });
    }

    const parsed = JSON.parse(raw.trim() || "{}") as { assignments?: { id: string; topic: string }[] };
    const assignments = parsed.assignments ?? [];

    if (assignments.length > 0) {
      await ctx.runMutation(api.knowledgeCards.bulkAssignTopics, {
        assignments: assignments.map((a) => ({ id: a.id as Id<"knowledgeCards">, topic: a.topic })),
      });
    }

    return { assigned: assignments.length };
  },
});

// Internal: incremental topic categorization for weekly cron
export const categorizeIncrementalCron = internalAction({
  args: {},
  handler: async (ctx) => {
    const allCards = await ctx.runQuery(internal.knowledgeCards.listInternal, {});
    const uncategorized = allCards.filter((c) => !c.topic);
    const existingTopics = [...new Set(allCards.map((c) => c.topic).filter(Boolean))] as string[];

    if (uncategorized.length === 0 || existingTopics.length === 0) {
      console.log("[cron] Topic categorization: nothing to do");
      return;
    }

    const topicsSection = `Topics: ${existingTopics.join(", ")}\n\n`;
    const cardsText = topicsSection + "Cards:\n" + uncategorized
      .map((c) => JSON.stringify({ id: c._id, q: c.front.slice(0, 100), a: c.back.slice(0, 100) }))
      .join("\n");

    const { content: raw, usage } = await callGrok(ASSIGN_INCREMENTAL_SYSTEM, cardsText, { maxTokens: 2048 });

    if (usage) {
      await ctx.runMutation(api.apiUsage.log, {
        source: "ai-topics-cron", provider: "grok",
        inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens,
      });
    }

    const parsed = JSON.parse(raw.trim() || "{}") as { assignments?: { id: string; topic: string }[] };
    const assignments = parsed.assignments ?? [];

    if (assignments.length > 0) {
      await ctx.runMutation(internal.knowledgeCards.bulkAssignTopicsInternal, {
        assignments: assignments.map((a) => ({ id: a.id as Id<"knowledgeCards">, topic: a.topic })),
      });
    }

    console.log(`[cron] Topic categorization: assigned ${assignments.length} cards`);
  },
});

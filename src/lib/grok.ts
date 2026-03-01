export type ParsedBrainDump = {
  deadlines: Array<{
    task: string;
    deadline: string;
    category: "Job" | "Lecture" | "Other";
  }>;
  media: Array<{
    title: string;
    category: "Sitcom" | "Anime" | "Film" | "Documentary" | "Series" | "Other";
    notes?: string;
  }>;
  knowledge_cards: Array<{
    front: string;
    back: string;
  }>;
  vault: Array<{
    title: string;
    url: string;
    urgency: number;
  }>;
  goals: Array<{
    title: string;
    description?: string;
    importance: number;
    size: "short" | "medium" | "long";
  }>;
};

const FAN_OUT_PROMPT = `You are a personal knowledge organizer. Parse the following brain dump text and return ONLY valid JSON with no markdown or explanation.

Extract items into these EXACT categories with EXACTLY these field names (no deviations):

deadlines — appointments, tasks, meetings, anything with a date.
  Fields: "task" (string), "deadline" (ISO date YYYY-MM-DD), "category" ("Job"|"Lecture"|"Other")

media — movies, shows, anime, series to watch.
  Fields: "title" (string), "category" ("Sitcom"|"Anime"|"Film"|"Documentary"|"Series"|"Other"), "notes" (optional string)

knowledge_cards — facts, formulas, definitions, things learned.
  Fields: "front" (string), "back" (string, may include LaTeX $...$)

vault — URLs and web links.
  Fields: "title" (string), "url" (string), "urgency" (integer 1-5)

goals — objectives, habits, resolutions, things to accomplish.
  Fields: "title" (string, required), "description" (optional string), "importance" (integer 1-5), "size" ("short"|"medium"|"long")

Return ONLY this exact JSON. Use empty arrays for categories with no items. Do NOT rename any field.
{"deadlines":[{"task":"...","deadline":"YYYY-MM-DD","category":"Job"}],"media":[{"title":"...","category":"Film"}],"knowledge_cards":[{"front":"...","back":"..."}],"vault":[{"title":"...","url":"...","urgency":3}],"goals":[{"title":"...","description":"...","importance":3,"size":"medium"}]}`;

const TIDY_PROMPT = `You are a personal note editor. Rewrite the user's rough note into a clean, concise version.

Rules:
- Keep it SHORT and NON-VERBOSE. Remove filler words and redundancy.
- Preserve all information — do not drop anything important.
- Use clear sentences or bullet points where appropriate.
- If no title is given (or the title field is empty), suggest a short, specific title (max 6 words).
- Return ONLY valid JSON: { "title": "...", "tidiedContent": "..." }`;

type AiUsage = { prompt_tokens: number; completion_tokens: number };

export type AiProvider = "grok" | "gpt";
export type GptModel = "gpt-5-mini" | "gpt-5-nano";

async function callGrok(systemPrompt: string, userContent: string, options?: { maxTokens?: number }): Promise<{ content: string; usage?: AiUsage }> {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) throw new Error("GROK_API_KEY is not set in .env.local");

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
      max_tokens: options?.maxTokens ?? 2048,
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

async function callGpt(systemPrompt: string, userContent: string, model: GptModel, options?: { maxTokens?: number; reasoningEffort?: "low" | "medium" | "high" }): Promise<{ content: string; usage?: AiUsage }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set in .env.local");

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

export type ParseBrainDumpResult = { parsed: ParsedBrainDump; usage?: AiUsage };

export async function parseBrainDump(text: string, provider: AiProvider = "grok", model: GptModel = "gpt-5-nano"): Promise<ParseBrainDumpResult> {
  const { content, usage } = provider === "gpt"
    ? await callGpt(FAN_OUT_PROMPT, text, model, { maxTokens: 8192 })
    : await callGrok(FAN_OUT_PROMPT, text, { maxTokens: 4096 });

  if (!content?.trim()) throw new Error("AI returned empty response — try again");
  // Strip any markdown code fences the model might wrap around JSON
  const jsonStr = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = JSON.parse(jsonStr) as Record<string, any[]>;

  // Normalize deadlines — model sometimes uses date/description/type instead of deadline/task/category
  const deadlines: ParsedBrainDump["deadlines"] = (raw.deadlines ?? []).map((d) => ({
    task: d.task ?? d.description ?? d.name ?? "",
    deadline: d.deadline ?? d.date ?? d.due ?? "",
    category: (["Job", "Lecture", "Other"].includes(d.category) ? d.category : d.type ?? "Other") as "Job" | "Lecture" | "Other",
  })).filter((d) => d.task && d.deadline);

  // Normalize goals — ensure title is always present
  const goals: ParsedBrainDump["goals"] = (raw.goals ?? []).map((g) => ({
    title: g.title ?? g.name ?? g.goal ?? "",
    description: g.description ?? g.details ?? undefined,
    importance: typeof g.importance === "number" ? Math.min(5, Math.max(1, g.importance)) : 3,
    size: (["short", "medium", "long"].includes(g.size) ? g.size : "medium") as "short" | "medium" | "long",
  })).filter((g) => g.title);

  return {
    parsed: {
      deadlines,
      media: raw.media ?? [],
      knowledge_cards: raw.knowledge_cards ?? [],
      vault: raw.vault ?? [],
      goals,
    },
    usage,
  };
}

export async function tidyText(
  content: string,
  title?: string,
  provider: AiProvider = "grok",
  model: GptModel = "gpt-5-nano"
): Promise<{ title: string; tidiedContent: string; usage?: AiUsage }> {
  const userContent = title ? `Title: ${title}\n\n${content}` : content;
  const { content: raw, usage } = provider === "gpt"
    ? await callGpt(TIDY_PROMPT, userContent, model)
    : await callGrok(TIDY_PROMPT, userContent);
  const parsed = JSON.parse(raw) as { title?: string; tidiedContent?: string };
  return {
    title: parsed.title ?? title ?? "Untitled",
    tidiedContent: parsed.tidiedContent ?? content,
    usage,
  };
}

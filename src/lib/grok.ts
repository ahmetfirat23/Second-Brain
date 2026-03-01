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

Extract items into these categories:
- deadlines: jobs, lectures, meetings, or anything with a date/deadline. Use ISO date format (YYYY-MM-DD) for deadline. Category must be "Job", "Lecture", or "Other".
- media: shows, movies, anime, sitcoms, or any entertainment to watch. Category must be "Sitcom", "Anime", "Film", "Documentary", "Series", or "Other".
- knowledge_cards: technical facts, formulas, definitions, or any "stuff I learned". front = question/concept, back = answer/explanation. Support LaTeX in back field using $...$ notation.
- vault: any URLs, links, or web resources. Urgency 1-5 (5 = most urgent).
- goals: things to do, objectives, resolutions, habits to build. importance 1-5 (5 = most important). size: "short" (quick task), "medium" (project), "long" (big goal).

Return ONLY this exact JSON structure with no extra text:
{"deadlines":[],"media":[],"knowledge_cards":[],"vault":[],"goals":[]}`;

const TIDY_PROMPT = `You are a personal note editor. Rewrite the user's rough note into a clean, concise version.

Rules:
- Keep it SHORT and NON-VERBOSE. Remove filler words and redundancy.
- Preserve all information — do not drop anything important.
- Use clear sentences or bullet points where appropriate.
- If no title is given (or the title field is empty), suggest a short, specific title (max 6 words).
- Return ONLY valid JSON: { "title": "...", "tidiedContent": "..." }`;

type GrokUsage = { prompt_tokens: number; completion_tokens: number };

async function callGrok(systemPrompt: string, userContent: string): Promise<{ content: string; usage?: GrokUsage }> {
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
      max_tokens: 2048,
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

export type ParseBrainDumpResult = { parsed: ParsedBrainDump; usage?: GrokUsage };

export async function parseBrainDump(text: string): Promise<ParseBrainDumpResult> {
  const { content, usage } = await callGrok(FAN_OUT_PROMPT, text);
  const parsed = JSON.parse(content) as Partial<ParsedBrainDump>;
  return {
    parsed: {
      deadlines: parsed.deadlines ?? [],
      media: parsed.media ?? [],
      knowledge_cards: parsed.knowledge_cards ?? [],
      vault: parsed.vault ?? [],
      goals: parsed.goals ?? [],
    },
    usage,
  };
}

export async function tidyText(
  content: string,
  title?: string
): Promise<{ title: string; tidiedContent: string; usage?: GrokUsage }> {
  const userContent = title ? `Title: ${title}\n\n${content}` : content;
  const { content: raw, usage } = await callGrok(TIDY_PROMPT, userContent);
  const parsed = JSON.parse(raw) as { title?: string; tidiedContent?: string };
  return {
    title: parsed.title ?? title ?? "Untitled",
    tidiedContent: parsed.tidiedContent ?? content,
    usage,
  };
}

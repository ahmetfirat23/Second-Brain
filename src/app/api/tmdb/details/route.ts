import { NextRequest, NextResponse } from "next/server";

export type TmdbDetails = {
  genres: string[];
  director: string | null;
  runtime: number | null;
  tmdbDetailUrl: string;
};

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const type = req.nextUrl.searchParams.get("type") ?? "movie";
  if (!id || !/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "TMDB_API_KEY not set" }, { status: 500 });

  const endpoint = type === "tv" ? "tv" : "movie";
  const url = `https://api.themoviedb.org/3/${endpoint}/${id}?language=en-US&append_to_response=credits`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, accept: "application/json" },
    next: { revalidate: 86400 },
  });

  if (!res.ok) return NextResponse.json({ error: "TMDB request failed" }, { status: 502 });

  type Genre = { id: number; name: string };
  type Crew = { job: string; name: string };
  const data = (await res.json()) as {
    genres?: Genre[];
    credits?: { crew?: Crew[] };
    runtime?: number;
  };

  const genres = (data.genres ?? []).map((g) => g.name);
  const director =
    data.credits?.crew?.find((c) => c.job === "Director")?.name ?? null;
  const runtime = data.runtime ?? null;
  const tmdbDetailUrl = `https://www.themoviedb.org/${endpoint}/${id}`;

  return NextResponse.json({
    genres,
    director,
    runtime,
    tmdbDetailUrl,
  } satisfies TmdbDetails);
}

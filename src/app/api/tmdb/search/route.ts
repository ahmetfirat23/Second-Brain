import { NextRequest, NextResponse } from "next/server";

export type TmdbResult = {
  id: number;
  title: string;
  mediaType: "Film" | "Series";
  posterUrl: string | null;
  overview: string;
  voteAverage: number;
  year: string;
};

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json([]);

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TMDB_API_KEY not set" }, { status: 500 });
  }

  const url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "TMDB request failed" }, { status: 502 });
  }

  type TmdbRaw = {
    id: number;
    media_type: string;
    title?: string;
    name?: string;
    poster_path?: string;
    overview?: string;
    vote_average?: number;
    release_date?: string;
    first_air_date?: string;
  };

  const data = (await res.json()) as { results: TmdbRaw[] };

  const results: TmdbResult[] = data.results
    .filter((r) => r.media_type === "movie" || r.media_type === "tv")
    .slice(0, 8)
    .map((r) => ({
      id: r.id,
      title: (r.title ?? r.name ?? "Unknown").trim(),
      mediaType: r.media_type === "movie" ? "Film" : "Series",
      posterUrl: r.poster_path
        ? `https://image.tmdb.org/t/p/w200${r.poster_path}`
        : null,
      overview: r.overview ?? "",
      voteAverage: Math.round((r.vote_average ?? 0) * 10) / 10,
      year: (r.release_date ?? r.first_air_date ?? "").slice(0, 4),
    }));

  return NextResponse.json(results);
}

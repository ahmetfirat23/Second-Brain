/**
 * Server-side TMDB API helper. Use for enriching media from brain dump grouping.
 */
export type TmdbMatch = {
  tmdbId: number;
  posterPath: string | null;
  overview: string;
  voteAverage: number;
  title: string;
};

export async function searchTmdb(title: string): Promise<TmdbMatch | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  const url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(title)}&include_adult=false&language=en-US&page=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, accept: "application/json" },
  });

  if (!res.ok) return null;

  type TmdbRaw = {
    id: number;
    media_type: string;
    title?: string;
    name?: string;
    poster_path?: string;
    overview?: string;
    vote_average?: number;
  };

  const data = (await res.json()) as { results: TmdbRaw[] };
  const match = data.results?.find((r) => r.media_type === "movie" || r.media_type === "tv");
  if (!match) return null;

  return {
    tmdbId: match.id,
    posterPath: match.poster_path ? `https://image.tmdb.org/t/p/w200${match.poster_path}` : null,
    overview: match.overview ?? "",
    voteAverage: Math.round((match.vote_average ?? 0) * 10) / 10,
    title: (match.title ?? match.name ?? "").trim(),
  };
}

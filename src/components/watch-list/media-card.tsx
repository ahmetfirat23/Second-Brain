"use client";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Search, Star, StarHalf, Trash2, X, Check, Eye, EyeOff, Send, ExternalLink } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import type { TmdbResult } from "@/app/api/tmdb/search/route";

const CATEGORIES = ["Sitcom", "Anime", "Film", "Documentary", "Series", "Other"] as const;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const CATEGORY_COLORS: Record<string, string> = {
  Sitcom: "bg-sky-900/40 text-sky-400 border-sky-800/50",
  Anime: "bg-pink-900/40 text-pink-400 border-pink-800/50",
  Film: "bg-amber-900/40 text-amber-400 border-amber-800/50",
  Documentary: "bg-emerald-900/40 text-emerald-400 border-emerald-800/50",
  Series: "bg-violet-900/40 text-violet-400 border-violet-800/50",
  Other: "bg-zinc-800/40 text-zinc-400 border-zinc-700/50",
};

type MediaItem = {
  _id: Id<"mediaList">;
  title: string;
  category: typeof CATEGORIES[number];
  notes?: string;
  aiConsensus?: string;
  sortOrder: number;
  posterPath?: string;
  overview?: string;
  voteAverage?: number;
  tmdbId?: number;
  watchedAt?: string;
  watchedNotes?: string;
  userRating?: number;
  genres?: string[];
  director?: string;
  tmdbMediaType?: string;
};

export function MediaCard({ item }: { item: MediaItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item._id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  const updateItem = useMutation(api.mediaList.update);
  const removeItem = useMutation(api.mediaList.remove);
  const markWatched = useMutation(api.mediaList.markWatched);
  const markUnwatched = useMutation(api.mediaList.markUnwatched);

  const [editing, setEditing] = useState(false);
  const [showWatchedModal, setShowWatchedModal] = useState(false);
  const [watchedNotes, setWatchedNotes] = useState(item.watchedNotes ?? "");
  const [userRating, setUserRating] = useState<number | undefined>(item.userRating);
  const [title, setTitle] = useState(item.title);
  const [category, setCategory] = useState(item.category);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [manualGenres, setManualGenres] = useState(item.genres?.join(", ") ?? "");
  const [manualDirector, setManualDirector] = useState(item.director ?? "");
  const [tmdbResults, setTmdbResults] = useState<TmdbResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTmdb, setSelectedTmdb] = useState<TmdbResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const isWatched = !!item.watchedAt;
  // Backward compat: old 1-5 ratings -> treat as 2,4,6,8,10
  const displayRating = item.userRating != null && item.userRating <= 5 ? item.userRating * 2 : item.userRating;
  const tmdbUrl =
    item.tmdbId && item.tmdbMediaType
      ? `https://www.themoviedb.org/${item.tmdbMediaType}/${item.tmdbId}`
      : null;

  function handleMarkWatched() {
    startTransition(async () => {
      await markWatched({ id: item._id, watchedNotes: watchedNotes.trim() || undefined, userRating });
      setShowWatchedModal(false);
    });
  }

  function handleMarkUnwatched() {
    if (!confirm("Move back to watch list?")) return;
    startTransition(async () => {
      await markUnwatched({ id: item._id });
      setShowWatchedModal(false);
    });
  }

  const debouncedTitle = useDebounce(title, 350);
  useEffect(() => {
    if (!editing || !debouncedTitle.trim() || selectedTmdb) {
      setTmdbResults([]);
      return;
    }
    setIsSearching(true);
    fetch(`/api/tmdb/search?q=${encodeURIComponent(debouncedTitle)}`)
      .then((r) => r.json())
      .then((data) => setTmdbResults(Array.isArray(data) ? data : []))
      .catch(() => setTmdbResults([]))
      .finally(() => setIsSearching(false));
  }, [editing, debouncedTitle, selectedTmdb]);

  function handleSave() {
    const fromTmdb = !!selectedTmdb;
    if (!fromTmdb && (!manualGenres.trim() || !manualDirector.trim())) {
      return; // require manual genre & director when not from TMDB
    }
    startTransition(async () => {
      if (fromTmdb && selectedTmdb) {
        const type = selectedTmdb.mediaType === "Series" ? "tv" : "movie";
        let genres: string[] | undefined;
        let director: string | undefined;
        try {
          const r = await fetch(`/api/tmdb/details?id=${selectedTmdb.id}&type=${type}`);
          if (r.ok) {
            const d = await r.json();
            genres = d.genres?.length ? d.genres : undefined;
            director = d.director ?? undefined;
          }
        } catch {
          /* ignore */
        }
        await updateItem({
          id: item._id,
          title: selectedTmdb.title,
          category: selectedTmdb.mediaType as typeof category,
          notes: notes.trim() || undefined,
          tmdbId: selectedTmdb.id,
          posterPath: selectedTmdb.posterUrl ?? undefined,
          overview: selectedTmdb.overview || undefined,
          voteAverage: selectedTmdb.voteAverage,
          genres,
          director,
          tmdbMediaType: type,
        });
      } else {
        const genresList = manualGenres.split(",").map((g) => g.trim()).filter(Boolean);
        await updateItem({
          id: item._id,
          title: title.trim(),
          category,
          notes: notes.trim() || undefined,
          genres: genresList.length ? genresList : undefined,
          director: manualDirector.trim() || undefined,
        });
      }
      setEditing(false);
      setSelectedTmdb(null);
    });
  }

  function handleCancel() {
    setTitle(item.title);
    setCategory(item.category);
    setNotes(item.notes ?? "");
    setManualGenres(item.genres?.join(", ") ?? "");
    setManualDirector(item.director ?? "");
    setSelectedTmdb(null);
    setTmdbResults([]);
    setEditing(false);
  }

  const catColor = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.Other;
  const hasPoster = !!item.posterPath;

  return (
    <div
      ref={setNodeRef} style={style}
      className={`group relative bg-[hsl(0_0%_7%)] border border-[hsl(0_0%_13%)] rounded-xl overflow-hidden flex flex-col transition-shadow ${
        isDragging ? "shadow-2xl z-50" : "hover:border-[hsl(0_0%_18%)]"
      }`}
    >
      {/* Drag handle */}
      <div {...attributes} {...listeners}
        className="absolute top-2 left-2 text-[hsl(0_0%_25%)] hover:text-[hsl(0_0%_45%)] cursor-grab active:cursor-grabbing z-10">
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Actions */}
      {!editing && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {isWatched && (
            <button
              onClick={() => {
                const parts: string[] = [`name: ${item.title}`];
                if (displayRating != null && displayRating > 0) {
                  parts.push(`rating: ${(displayRating / 2).toFixed(1)}/5`);
                }
                if (item.watchedNotes?.trim()) {
                  parts.push(`comment: ${item.watchedNotes.trim()}`);
                }
                window.dispatchEvent(new CustomEvent("movie-chat-insert", { detail: { text: parts.join(", ") } }));
              }}
              className="p-1.5 rounded-md bg-[hsl(0_0%_10%/0.9)] hover:bg-[hsl(0_0%_14%)] text-[hsl(0_0%_40%)] hover:text-violet-400 transition-colors"
              title="Open chat and insert"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => { setWatchedNotes(item.watchedNotes ?? ""); setUserRating(item.userRating != null && item.userRating <= 5 ? item.userRating * 2 : item.userRating); setShowWatchedModal(true); }}
            className={`p-1.5 rounded-md bg-[hsl(0_0%_10%/0.9)] hover:bg-[hsl(0_0%_14%)] transition-colors ${isWatched ? "text-emerald-400" : "text-[hsl(0_0%_40%)] hover:text-emerald-400"}`}
            title={isWatched ? "Edit watched notes" : "Mark as watched"}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setTitle(item.title);
              setCategory(item.category);
              setNotes(item.notes ?? "");
              setManualGenres(item.genres?.join(", ") ?? "");
              setManualDirector(item.director ?? "");
              setSelectedTmdb(null);
              setTmdbResults([]);
              setEditing(true);
            }}
            className="p-1.5 rounded-md bg-[hsl(0_0%_10%/0.9)] hover:bg-[hsl(0_0%_14%)] text-[hsl(0_0%_40%)] hover:text-white transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { if (confirm(`Delete "${item.title}"?`)) removeItem({ id: item._id }); }}
            disabled={isPending}
            className="p-1.5 rounded-md bg-[hsl(0_0%_10%/0.9)] hover:bg-red-900/60 text-[hsl(0_0%_40%)] hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Watched modal */}
      {showWatchedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowWatchedModal(false)}>
          <div className="bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_18%)] rounded-xl p-4 w-full max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-white mb-3">{isWatched ? "Edit watched" : "Mark as watched"}</h3>
            <p className="text-xs text-[hsl(0_0%_45%)] mb-3">Add notes and your rating so the chatbot can learn your taste.</p>
            <textarea value={watchedNotes} onChange={(e) => setWatchedNotes(e.target.value)} rows={3}
              placeholder="Your thoughts, opinions…"
              className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[hsl(0_0%_30%)] outline-none resize-none mb-3" />
            <div className="flex items-center gap-0.5 mb-4">
              <span className="text-xs text-[hsl(0_0%_45%)] mr-1">Your rating:</span>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
                <button
                  key={r}
                  onClick={() => setUserRating(userRating === r ? undefined : r)}
                  className={`p-0.5 rounded focus:outline-none ${r <= (userRating ?? 0) ? "text-yellow-400" : "text-[hsl(0_0%_35%)] hover:text-yellow-400/70"}`}
                  title={`${(r / 2).toFixed(1)}/5`}
                >
                  <StarHalf className={`w-4 h-4 ${r <= (userRating ?? 0) ? "fill-yellow-400" : ""}`} />
                </button>
              ))}
              <span className="text-xs text-[hsl(0_0%_45%)] ml-1">
                {(userRating ?? 0) > 0 ? `${((userRating ?? 0) / 2).toFixed(1)}/5` : ""}
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={handleMarkWatched} disabled={isPending}
                className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium">
                {isWatched ? "Save" : "Mark watched"}
              </button>
              {isWatched && (
                <button onClick={handleMarkUnwatched} disabled={isPending}
                  className="px-3 py-2 rounded-lg bg-[hsl(0_0%_12%)] hover:bg-[hsl(0_0%_15%)] text-[hsl(0_0%_50%)] text-sm flex items-center gap-1">
                  <EyeOff className="w-3.5 h-3.5" /> Back to list
                </button>
              )}
              <button onClick={() => setShowWatchedModal(false)}
                className="px-3 py-2 rounded-lg bg-[hsl(0_0%_12%)] text-[hsl(0_0%_60%)] text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {!editing ? (
        <>
          {/* Poster + header */}
          {hasPoster ? (
            <div className="relative">
              <img
                src={item.posterPath!}
                alt={item.title}
                className="w-full h-40 object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[hsl(0_0%_7%)] via-transparent to-transparent" />
              {item.voteAverage !== undefined && item.voteAverage > 0 && (
                <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm text-yellow-400 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                  <Star className="w-3 h-3 fill-yellow-400" />
                  {item.voteAverage.toFixed(1)}
                </div>
              )}
            </div>
          ) : null}

          <div className="p-4 flex flex-col gap-2 flex-1">
            <div className="flex items-start gap-2 pl-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-white leading-snug">{item.title}</h3>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {isWatched && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-400 bg-emerald-900/40 border border-emerald-800/50 px-2 py-0.5 rounded-full">
                      <Eye className="w-2.5 h-2.5" /> Watched
                    </span>
                  )}
                  <span className={`inline-flex text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${catColor}`}>
                    {item.category}
                  </span>
                  {displayRating !== undefined && displayRating > 0 && (
                    <span className="flex items-center gap-0.5 text-xs text-amber-400 font-medium">
                      <Star className="w-3 h-3 fill-amber-400" />
                      {(displayRating / 2).toFixed(1)}/5
                    </span>
                  )}
                  {!hasPoster && item.voteAverage !== undefined && item.voteAverage > 0 && !displayRating && (
                    <span className="flex items-center gap-0.5 text-xs text-yellow-400 font-medium">
                      <Star className="w-3 h-3 fill-yellow-400" />
                      {item.voteAverage.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Genre, director */}
            {(item.genres?.length || item.director) && (
              <div className="flex flex-wrap gap-1.5 text-[10px] text-[hsl(0_0%_45%)]">
                {item.genres?.map((g) => (
                  <span key={g} className="px-1.5 py-0.5 rounded bg-[hsl(0_0%_12%)]">{g}</span>
                ))}
                {item.director && <span className="italic">dir. {item.director}</span>}
              </div>
            )}
            {/* TMDB overview */}
            {item.overview && (
              <p className="text-xs text-[hsl(0_0%_45%)] leading-relaxed line-clamp-3">{item.overview}</p>
            )}
            {/* TMDB link */}
            {tmdbUrl && (
              <a href={tmdbUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-[hsl(0_0%_40%)] hover:text-violet-400 transition-colors">
                <ExternalLink className="w-3 h-3" /> More on TMDB
              </a>
            )}

            {/* Personal notes */}
            {item.notes && (
              <p className="text-xs text-[hsl(0_0%_55%)] leading-relaxed italic border-t border-[hsl(0_0%_12%)] pt-2">{item.notes}</p>
            )}
            {/* Watched notes / opinion */}
            {isWatched && item.watchedNotes && (
              <p className="text-xs text-emerald-400/90 leading-relaxed italic border-t border-[hsl(0_0%_12%)] pt-2">{item.watchedNotes}</p>
            )}
          </div>
        </>
      ) : (
        <div className="p-4 space-y-2 flex-1">
          {/* Title with TMDB search */}
          <div className="relative">
            <div className="flex items-center gap-2 bg-[hsl(0_0%_10%)] border border-[hsl(263_90%_60%/0.4)] rounded-lg px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-[hsl(0_0%_35%)] shrink-0" />
              <input
                value={title}
                onChange={(e) => { setTitle(e.target.value); setSelectedTmdb(null); }}
                className="flex-1 bg-transparent text-sm text-white outline-none"
                placeholder="Search TMDB or type title…"
              />
              {isSearching && (
                <span className="text-[10px] text-[hsl(0_0%_40%)] animate-pulse">Searching…</span>
              )}
              {selectedTmdb && (
                <button onClick={() => setSelectedTmdb(null)} className="text-xs text-[hsl(0_0%_35%)] hover:text-white">
                  Clear
                </button>
              )}
            </div>
            {tmdbResults.length > 0 && !selectedTmdb && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_18%)] rounded-lg shadow-xl z-20 max-h-40 overflow-y-auto">
                {tmdbResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { setSelectedTmdb(r); setTitle(r.title); setCategory(r.mediaType as typeof category); setTmdbResults([]); }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[hsl(0_0%_13%)] text-left"
                  >
                    {r.posterUrl ? (
                      <img src={r.posterUrl} alt="" className="w-6 h-9 object-cover rounded shrink-0" />
                    ) : (
                      <div className="w-6 h-9 bg-[hsl(0_0%_14%)] rounded shrink-0" />
                    )}
                    <span className="text-xs text-white truncate">{r.title}</span>
                    <span className="text-[10px] text-[hsl(0_0%_40%)] shrink-0">{r.mediaType} {r.year}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedTmdb ? (
            <p className="text-[10px] text-emerald-400/90">Using TMDB: {selectedTmdb.title}</p>
          ) : (
            <>
              <input
                value={manualGenres}
                onChange={(e) => setManualGenres(e.target.value)}
                placeholder="Genres (comma-separated, required)"
                className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-[hsl(0_0%_35%)] outline-none"
              />
              <input
                value={manualDirector}
                onChange={(e) => setManualDirector(e.target.value)}
                placeholder="Director (required)"
                className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-[hsl(0_0%_35%)] outline-none"
              />
            </>
          )}

          <select value={category} onChange={(e) => setCategory(e.target.value as typeof CATEGORIES[number])}
            className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] rounded-lg px-3 py-1.5 text-sm text-white outline-none">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            placeholder="Personal notes…"
            className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-[hsl(0_0%_30%)] outline-none resize-none" />

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={isPending || (!selectedTmdb && (!manualGenres.trim() || !manualDirector.trim()))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(263_90%_60%)] text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-3 h-3" /> Save
            </button>
            <button onClick={handleCancel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(0_0%_12%)] text-[hsl(0_0%_60%)] text-xs">
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

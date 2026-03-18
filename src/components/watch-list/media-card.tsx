"use client";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft, Check, Eye, EyeOff, ExternalLink, GripVertical,
  Pencil, Search, Send, Star, Trash2, X,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import type { TmdbResult } from "@/app/api/tmdb/search/route";

const CATEGORIES = ["Sitcom", "Anime", "Film", "Documentary", "Series", "Other"] as const;

/**
 * Display 5 stars (full/half/empty) from a 0–10 value.
 * Shows label as X/10.
 */
function StarDisplay({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
  const px = size === "md" ? "w-5 h-5" : "w-3.5 h-3.5";
  const stars = Array.from({ length: 5 }, (_, i) => {
    const filled = value / 2 - i;
    return filled >= 1 ? "full" : filled >= 0.5 ? "half" : "empty";
  });
  return (
    <span className="flex items-center gap-0.5">
      {stars.map((type, i) => (
        <span key={i} className="relative inline-block">
          <Star className={`${px} text-[hsl(0_0%_28%)]`} />
          {type !== "empty" && (
            <span className="absolute inset-0 overflow-hidden" style={{ width: type === "half" ? "50%" : "100%" }}>
              <Star className={`${px} fill-[hsl(263_70%_70%)] text-[hsl(263_70%_70%)]`} />
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

/**
 * Click-to-rate 1–10. Each of the 10 stars = 1 point.
 * Old data stored as 1–5 is already doubled before being passed in.
 */
function StarPicker({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? value ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-0.5" onMouseLeave={() => setHovered(null)}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => (
        <button
          key={score}
          type="button"
          onMouseEnter={() => setHovered(score)}
          onClick={() => onChange(value === score ? undefined : score)}
          className="p-0.5 focus:outline-none"
          title={`${score}/10`}
        >
          <Star
            className={`w-5 h-5 transition-colors ${
              score <= active
                ? "fill-[hsl(263_70%_70%)] text-[hsl(263_70%_70%)]"
                : "text-[hsl(0_0%_30%)] hover:text-[hsl(263_70%_70%)]/40"
            }`}
          />
        </button>
      ))}
      {value !== undefined && (
        <span className="text-sm text-[hsl(0_0%_60%)] ml-1">{value}/10</span>
      )}
    </div>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const CATEGORY_COLORS: Record<string, string> = {
  Sitcom: "bg-[hsl(0_0%_15%)] text-[hsl(0_0%_65%)] border-[hsl(0_0%_22%)]",
  Anime: "bg-[hsl(0_0%_15%)] text-[hsl(0_0%_65%)] border-[hsl(0_0%_22%)]",
  Film: "bg-[hsl(0_0%_15%)] text-[hsl(0_0%_65%)] border-[hsl(0_0%_22%)]",
  Documentary: "bg-[hsl(0_0%_15%)] text-[hsl(0_0%_65%)] border-[hsl(0_0%_22%)]",
  Series: "bg-[hsl(0_0%_15%)] text-[hsl(0_0%_65%)] border-[hsl(0_0%_22%)]",
  Other: "bg-[hsl(0_0%_15%)] text-[hsl(0_0%_65%)] border-[hsl(0_0%_22%)]",
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
  runtime?: number;
};

function formatRuntime(mins: number | undefined): string | null {
  if (!mins) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/* ─────────────────────────────────────────────
   Combined Detail + Edit Modal
───────────────────────────────────────────── */
function ItemModal({
  item,
  initialView = "detail",
  onClose,
  onDelete,
}: {
  item: MediaItem;
  initialView?: "detail" | "edit";
  onClose: () => void;
  onDelete: () => void;
}) {
  const updateItem = useMutation(api.mediaList.update);
  const markWatched = useMutation(api.mediaList.markWatched);
  const markUnwatched = useMutation(api.mediaList.markUnwatched);

  const [view, setView] = useState<"detail" | "edit" | "watched">(initialView);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (view !== "detail") setView("detail"); // sub-views go back, don't close
        else onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, onClose]);
  const [isPending, startTransition] = useTransition();

  /* ── edit state ── */
  const [editTitle, setEditTitle] = useState(item.title);
  const [editCategory, setEditCategory] = useState(item.category);
  const [editNotes, setEditNotes] = useState(item.notes ?? "");
  const [editGenres, setEditGenres] = useState(item.genres?.join(", ") ?? "");
  const [editDirector, setEditDirector] = useState(item.director ?? "");
  const [selectedTmdb, setSelectedTmdb] = useState<TmdbResult | null>(null);
  const [tmdbResults, setTmdbResults] = useState<TmdbResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  /* ── watched state ── */
  const [watchedNotes, setWatchedNotes] = useState(item.watchedNotes ?? "");
  const [userRating, setUserRating] = useState<number | undefined>(
    item.userRating != null && item.userRating <= 5 ? item.userRating * 2 : item.userRating
  );

  const isWatched = !!item.watchedAt;
  const displayRating = item.userRating != null && item.userRating <= 5 ? item.userRating * 2 : item.userRating;
  const runtimeStr = formatRuntime(item.runtime);
  const catColor = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.Other;
  const tmdbUrl = item.tmdbId && item.tmdbMediaType
    ? `https://www.themoviedb.org/${item.tmdbMediaType}/${item.tmdbId}`
    : null;

  /* TMDB search while editing */
  const debouncedTitle = useDebounce(editTitle, 350);
  useEffect(() => {
    if (view !== "edit" || !debouncedTitle.trim() || selectedTmdb) { setTmdbResults([]); return; }
    setIsSearching(true);
    fetch(`/api/tmdb/search?q=${encodeURIComponent(debouncedTitle)}`)
      .then((r) => r.json())
      .then((data) => setTmdbResults(Array.isArray(data) ? data : []))
      .catch(() => setTmdbResults([]))
      .finally(() => setIsSearching(false));
  }, [view, debouncedTitle, selectedTmdb]);

  function handleSave() {
    const fromTmdb = !!selectedTmdb;
    if (!fromTmdb && (!editGenres.trim() || !editDirector.trim())) return;
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
        } catch { /* ignore */ }
        await updateItem({
          id: item._id,
          title: selectedTmdb.title,
          category: selectedTmdb.mediaType as typeof editCategory,
          notes: editNotes.trim() || undefined,
          tmdbId: selectedTmdb.id,
          posterPath: selectedTmdb.posterUrl ?? undefined,
          overview: selectedTmdb.overview || undefined,
          voteAverage: selectedTmdb.voteAverage,
          genres,
          director,
          tmdbMediaType: type,
        });
      } else {
        const genresList = editGenres.split(",").map((g) => g.trim()).filter(Boolean);
        await updateItem({
          id: item._id,
          title: editTitle.trim(),
          category: editCategory,
          notes: editNotes.trim() || undefined,
          genres: genresList.length ? genresList : undefined,
          director: editDirector.trim() || undefined,
        });
      }
      setSelectedTmdb(null);
      setView("detail");
    });
  }

  function handleMarkWatched() {
    startTransition(async () => {
      await markWatched({ id: item._id, watchedNotes: watchedNotes.trim() || undefined, userRating });
      setView("detail");
    });
  }

  function handleMarkUnwatched() {
    if (!confirm("Move back to watch list?")) return;
    startTransition(async () => {
      await markUnwatched({ id: item._id });
      setView("detail");
    });
  }

  function sendToChat() {
    const lines: string[] = [`**${item.title}**`];
    const meta: string[] = [item.category];
    if (runtimeStr) meta.push(runtimeStr);
    if (item.genres?.length) meta.push(item.genres.join(", "));
    if (item.director) meta.push(`dir. ${item.director}`);
    if (meta.length) lines.push(meta.join(" · "));
    const ratings: string[] = [];
    if (item.voteAverage && item.voteAverage > 0) ratings.push(`TMDB ${item.voteAverage.toFixed(1)}/10`);
    if (displayRating != null && displayRating > 0) ratings.push(`my rating ${displayRating}/10`);
    if (ratings.length) lines.push(ratings.join(", "));
    if (item.watchedNotes?.trim()) lines.push(`(watched) my review: ${item.watchedNotes.trim()}`);
    else if (isWatched) lines.push("(watched)");
    else lines.push("(not watched yet)");
    window.dispatchEvent(new CustomEvent("movie-chat-insert", { detail: { text: lines.join("\n") } }));
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[hsl(0_0%_11%)] border border-[hsl(0_0%_22%)] rounded-lg w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── DETAIL VIEW ── */}
        {view === "detail" && (
          <>
            {/* Header */}
            <div className="flex gap-4 p-4">
              {item.posterPath ? (
                <img src={item.posterPath} alt={item.title} className="w-24 rounded-lg object-cover shrink-0 self-start" />
              ) : (
                <div className="w-24 h-36 rounded-lg bg-[hsl(0_0%_16%)] shrink-0 flex items-center justify-center">
                  <span className="text-[10px] text-[hsl(0_0%_50%)] text-center px-1">{item.title}</span>
                </div>
              )}
              <div className="flex-1 min-w-0 pt-1">
                <h2 className="text-base font-semibold text-white leading-snug mb-2">{item.title}</h2>

                {/* Row 1: category + watched badges + runtime */}
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${catColor}`}>
                    {item.category}
                  </span>
                  {isWatched && (
                    <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-900/40 border border-emerald-700/60 px-2 py-0.5 rounded flex items-center gap-1">
                      <Eye className="w-2.5 h-2.5" /> Watched
                    </span>
                  )}
                  {runtimeStr && (
                    <span className="text-[10px] text-[hsl(0_0%_56%)]">{runtimeStr}</span>
                  )}
                </div>

                {/* Row 2: both ratings side by side */}
                {(item.voteAverage && item.voteAverage > 0) || (displayRating !== undefined && displayRating > 0) ? (
                  <div className="flex items-center gap-3 mb-2">
                    {item.voteAverage && item.voteAverage > 0 && (
                      <span className="flex items-center gap-1 text-xs text-yellow-400">
                        <Star className="w-3 h-3 fill-yellow-400" />
                        <span className="font-medium">{item.voteAverage.toFixed(1)}</span>
                        <span className="text-[10px] text-[hsl(0_0%_50%)]">TMDB</span>
                      </span>
                    )}
                    {displayRating !== undefined && displayRating > 0 && (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <Star className="w-3 h-3 fill-emerald-400" />
                        <span className="font-medium">{displayRating}/10</span>
                        <span className="text-[10px] text-[hsl(0_0%_50%)]">yours</span>
                      </span>
                    )}
                  </div>
                ) : null}

                {/* Overview — immediately below ratings */}
                {item.overview && (
                  <p className="text-xs text-[hsl(0_0%_72%)] leading-relaxed line-clamp-4 mb-2">{item.overview}</p>
                )}

                {/* Genres */}
                {item.genres && item.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {item.genres.map((g) => (
                      <span key={g} className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(0_0%_16%)] text-[hsl(0_0%_68%)]">{g}</span>
                    ))}
                  </div>
                )}
                {item.director && (
                  <p className="text-xs text-[hsl(0_0%_56%)] italic">dir. {item.director}</p>
                )}
              </div>
              <button onClick={onClose} className="self-start p-1 text-[hsl(0_0%_50%)] hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body — only notes/review/links if present */}
            <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-4">
              {item.notes && (
                <div className="bg-[hsl(0_0%_9%)] rounded-lg p-3 border border-[hsl(0_0%_20%)]">
                  <p className="text-[10px] uppercase tracking-wider text-[hsl(0_0%_50%)] mb-1.5">Your notes</p>
                  <p className="text-sm text-[hsl(0_0%_72%)] leading-relaxed italic">{item.notes}</p>
                </div>
              )}
              {isWatched && (
                <div className="bg-emerald-950/30 rounded-lg p-3 border border-emerald-900/40">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-500/70 mb-2">Your review</p>
                  {displayRating !== undefined && displayRating > 0 && (
                    <div className="flex items-center gap-2 mb-2">
                      <StarDisplay value={displayRating} size="md" />
                      <span className="text-sm text-[hsl(0_0%_64%)]">{displayRating}/10</span>
                    </div>
                  )}
                  {item.watchedNotes ? (
                    <p className="text-sm text-emerald-200/80 leading-relaxed italic">{item.watchedNotes}</p>
                  ) : (
                    <p className="text-xs text-[hsl(0_0%_45%)] italic">No review yet — click "Edit watched" to add one.</p>
                  )}
                </div>
              )}
              {tmdbUrl && (
                <a href={tmdbUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[hsl(0_0%_55%)] hover:text-violet-400 transition-colors">
                  <ExternalLink className="w-3 h-3" /> More on TMDB
                </a>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center gap-1.5 px-3 py-3 border-t border-[hsl(0_0%_20%)]">
              <button
                onClick={() => setView("watched")}
                title={isWatched ? "Edit watched" : "Mark watched"}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                  isWatched
                    ? "bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-800/40"
                    : "bg-[hsl(0_0%_14%)] hover:bg-emerald-900/30 text-[hsl(0_0%_68%)] hover:text-emerald-400"
                }`}>
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isWatched ? "Edit watched" : "Mark watched"}</span>
              </button>
              <button
                onClick={() => setView("edit")}
                title="Edit"
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-[hsl(0_0%_14%)] hover:bg-[hsl(0_0%_20%)] text-[hsl(0_0%_68%)] hover:text-white text-xs transition-colors">
                <Pencil className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </button>
              <button onClick={sendToChat}
                title="Send to chat"
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-[hsl(0_0%_14%)] hover:bg-violet-900/40 text-[hsl(0_0%_68%)] hover:text-violet-300 text-xs transition-colors">
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Chat</span>
              </button>
              <button
                onClick={() => { onDelete(); onClose(); }}
                title="Delete"
                className="ml-auto flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-[hsl(0_0%_14%)] hover:bg-red-900/40 text-[hsl(0_0%_68%)] hover:text-red-400 text-xs transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            </div>
          </>
        )}

        {/* ── EDIT VIEW ── */}
        {view === "edit" && (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(0_0%_20%)]">
              <button onClick={() => setView("detail")} className="p-1 text-[hsl(0_0%_55%)] hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h3 className="text-sm font-medium text-white flex-1">Edit</h3>
              <button onClick={onClose} className="p-1 text-[hsl(0_0%_50%)] hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {/* TMDB search */}
              <div className="relative">
                <div className="flex items-center gap-2 bg-[hsl(0_0%_10%)] border border-[hsl(263_90%_60%/0.4)] rounded-lg px-3 py-2">
                  <Search className="w-3.5 h-3.5 text-[hsl(0_0%_64%)] shrink-0" />
                  <input
                    value={editTitle}
                    onChange={(e) => { setEditTitle(e.target.value); setSelectedTmdb(null); }}
                    className="flex-1 bg-transparent text-sm text-white outline-none"
                    placeholder="Search TMDB or type title…"
                    autoFocus
                  />
                  {isSearching && <span className="text-[10px] text-[hsl(0_0%_68%)] animate-pulse">Searching…</span>}
                  {selectedTmdb && (
                    <button onClick={() => setSelectedTmdb(null)} className="text-xs text-[hsl(0_0%_64%)] hover:text-white">Clear</button>
                  )}
                </div>
                {tmdbResults.length > 0 && !selectedTmdb && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[hsl(0_0%_13%)] border border-[hsl(0_0%_28%)] rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                    {tmdbResults.map((r) => (
                      <button key={r.id}
                        onClick={() => { setSelectedTmdb(r); setEditTitle(r.title); setEditCategory(r.mediaType as typeof editCategory); setTmdbResults([]); }}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[hsl(0_0%_16%)] text-left">
                        {r.posterUrl
                          ? <img src={r.posterUrl} alt="" className="w-7 h-10 object-cover rounded shrink-0" />
                          : <div className="w-7 h-10 bg-[hsl(0_0%_14%)] rounded shrink-0" />
                        }
                        <div className="min-w-0">
                          <p className="text-xs text-white truncate">{r.title}</p>
                          <p className="text-[10px] text-[hsl(0_0%_60%)]">{r.mediaType} {r.year}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedTmdb ? (
                <p className="text-[10px] text-emerald-400/90 px-1">Using TMDB data for: {selectedTmdb.title}</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <input value={editGenres} onChange={(e) => setEditGenres(e.target.value)}
                    placeholder="Genres (comma-sep, required)"
                    className="col-span-2 bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[hsl(0_0%_55%)] outline-none" />
                  <input value={editDirector} onChange={(e) => setEditDirector(e.target.value)}
                    placeholder="Director (required)"
                    className="col-span-2 bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[hsl(0_0%_55%)] outline-none" />
                </div>
              )}

              <select value={editCategory} onChange={(e) => setEditCategory(e.target.value as typeof CATEGORIES[number])}
                className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-2 text-sm text-white outline-none [color-scheme:dark]">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>

              <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3}
                placeholder="Personal notes (optional)…"
                className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[hsl(0_0%_55%)] outline-none resize-none" />
            </div>

            <div className="flex items-center gap-2 px-4 py-3 border-t border-[hsl(0_0%_20%)]">
              <button onClick={() => setView("detail")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[hsl(0_0%_14%)] text-[hsl(0_0%_68%)] text-sm hover:bg-[hsl(0_0%_20%)] transition-colors">
                Cancel
              </button>
              <button onClick={handleSave}
                disabled={isPending || (!selectedTmdb && (!editGenres.trim() || !editDirector.trim()))}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[hsl(263_90%_60%)] hover:bg-[hsl(263_90%_65%)] text-white text-sm font-medium disabled:opacity-50 transition-colors">
                <Check className="w-3.5 h-3.5" /> Save changes
              </button>
            </div>
          </>
        )}

        {/* ── WATCHED VIEW ── */}
        {view === "watched" && (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(0_0%_20%)]">
              <button onClick={() => setView("detail")} className="p-1 text-[hsl(0_0%_55%)] hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h3 className="text-sm font-medium text-white flex-1">
                {isWatched ? "Edit watched" : "Mark as watched"}
              </h3>
              <button onClick={onClose} className="p-1 text-[hsl(0_0%_50%)] hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              <p className="text-xs text-[hsl(0_0%_64%)]">Add your thoughts and rating — the chatbot uses this to learn your taste.</p>
              <textarea value={watchedNotes} onChange={(e) => setWatchedNotes(e.target.value)} rows={4}
                placeholder="Your thoughts, what you loved or hated…"
                className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[hsl(0_0%_55%)] outline-none resize-none" />
              <div>
                <p className="text-xs text-[hsl(0_0%_60%)] mb-2">Your rating</p>
                <StarPicker value={userRating} onChange={setUserRating} />
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 py-3 border-t border-[hsl(0_0%_20%)]">
              <button onClick={() => setView("detail")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[hsl(0_0%_14%)] text-[hsl(0_0%_68%)] text-sm hover:bg-[hsl(0_0%_20%)] transition-colors">
                Cancel
              </button>
              <button onClick={handleMarkWatched} disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50 transition-colors">
                <Check className="w-3.5 h-3.5" /> {isWatched ? "Save review" : "Mark watched"}
              </button>
              {isWatched && (
                <button onClick={handleMarkUnwatched} disabled={isPending}
                  className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[hsl(0_0%_14%)] hover:bg-[hsl(0_0%_20%)] text-[hsl(0_0%_60%)] text-sm transition-colors">
                  <EyeOff className="w-3.5 h-3.5" /> Move back
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Poster Card
───────────────────────────────────────────── */
export function MediaCard({ item }: { item: MediaItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item._id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  const removeItem = useMutation(api.mediaList.remove);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalView, setModalView] = useState<"detail" | "edit">("detail");

  const isWatched = !!item.watchedAt;
  const displayRating = item.userRating != null && item.userRating <= 5 ? item.userRating * 2 : item.userRating;
  const runtimeStr = formatRuntime(item.runtime);
  const catColor = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.Other;
  const hasPoster = !!item.posterPath;
  const genreText = item.genres?.slice(0, 3).join(" · ");

  function openModal(view: "detail" | "edit" = "detail") {
    setModalView(view);
    setModalOpen(true);
  }

  function sendToChat(e: React.MouseEvent) {
    e.stopPropagation();
    const lines: string[] = [`**${item.title}**`];
    const meta: string[] = [item.category];
    if (runtimeStr) meta.push(runtimeStr);
    if (item.genres?.length) meta.push(item.genres.join(", "));
    if (item.director) meta.push(`dir. ${item.director}`);
    if (meta.length) lines.push(meta.join(" · "));
    const ratings: string[] = [];
    if (item.voteAverage && item.voteAverage > 0) ratings.push(`TMDB ${item.voteAverage.toFixed(1)}/10`);
    if (displayRating != null && displayRating > 0) ratings.push(`my rating ${displayRating}/10`);
    if (ratings.length) lines.push(ratings.join(", "));
    if (item.watchedNotes?.trim()) lines.push(`(watched) my review: ${item.watchedNotes.trim()}`);
    else if (isWatched) lines.push("(watched)");
    else lines.push("(not watched yet)");
    window.dispatchEvent(new CustomEvent("movie-chat-insert", { detail: { text: lines.join("\n") } }));
  }

  return (
    <>
      {modalOpen && (
        <ItemModal
          item={item}
          initialView={modalView}
          onClose={() => setModalOpen(false)}
          onDelete={() => { if (confirm(`Delete "${item.title}"?`)) removeItem({ id: item._id }); }}
        />
      )}

      <div
        ref={setNodeRef} style={style}
        onClick={() => openModal("detail")}
        className={`group relative aspect-[2/3] rounded-lg overflow-hidden border cursor-pointer transition-all duration-200 select-none ${
          isDragging
            ? "border-[hsl(0_0%_22%)] shadow-2xl z-50"
            : "border-[hsl(0_0%_22%)] hover:border-[hsl(0_0%_38%)] hover:shadow-lg"
        }`}
      >
        {/* Poster */}
        {hasPoster ? (
          <img src={item.posterPath!} alt={item.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-4 bg-gradient-to-b from-[hsl(0_0%_14%)] to-[hsl(0_0%_8%)]">
            <p className="text-xs font-semibold text-white/80 text-center leading-snug">{item.title}</p>
          </div>
        )}

        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

        {/* Bottom info — compact 2-row layout */}
        <div className="absolute bottom-0 left-0 right-0 px-2 py-2 pointer-events-none">
          {/* Row 1: Title */}
          <p className="text-[11px] font-semibold text-white leading-tight mb-1 line-clamp-2 drop-shadow-md">{item.title}</p>

          {/* Row 2: badges + ratings all on one line */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${catColor}`}>{item.category}</span>
            {item.voteAverage && item.voteAverage > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] text-yellow-400 ml-auto">
                <Star className="w-2.5 h-2.5 fill-yellow-400" />{item.voteAverage.toFixed(1)}
              </span>
            )}
            {displayRating !== undefined && displayRating > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] text-emerald-400 font-semibold">
                <Star className="w-2.5 h-2.5 fill-emerald-400" />{displayRating}
              </span>
            )}
          </div>

          {/* Overview — expands on hover */}
          {item.overview && (
            <div className="max-h-0 overflow-hidden group-hover:max-h-20 transition-[max-height] duration-300">
              <p className="text-[9px] text-white/75 leading-relaxed line-clamp-3 pt-1">
                {item.overview}
              </p>
            </div>
          )}
        </div>

        {/* Drag handle — always visible on mobile, hover-only on desktop */}
        <div {...attributes} {...listeners}
          className="absolute top-1.5 left-1.5 opacity-40 lg:opacity-0 lg:group-hover:opacity-70 cursor-grab active:cursor-grabbing z-10 transition-opacity duration-150 select-none"
          style={{ touchAction: "none" }}
          onClick={(e) => e.stopPropagation()}>
          <GripVertical className="w-4 h-4 text-white drop-shadow-md" />
        </div>

        {/* Quick actions — desktop hover only */}
        <div className="absolute top-1.5 right-1.5 hidden lg:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10"
          onClick={(e) => e.stopPropagation()}>
          <button
            onClick={sendToChat}
            className="p-1 rounded bg-black/60 hover:bg-violet-900/80 text-white/80 hover:text-violet-300 transition-colors backdrop-blur-sm"
            title="Send to chat"
          >
            <Send className="w-3 h-3" />
          </button>
          <button
            onClick={() => openModal("edit")}
            className="p-1 rounded bg-black/60 hover:bg-black/80 text-white/80 hover:text-white transition-colors backdrop-blur-sm"
            title="Edit"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={() => { if (confirm(`Delete "${item.title}"?`)) removeItem({ id: item._id }); }}
            className="p-1 rounded bg-black/60 hover:bg-red-900/80 text-white/80 hover:text-red-300 transition-colors backdrop-blur-sm"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </>
  );
}

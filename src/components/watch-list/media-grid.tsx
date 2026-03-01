"use client";

import { api } from "../../../convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import {
  DndContext, DragEndEvent, KeyboardSensor, PointerSensor,
  closestCenter, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { ArrowDownToLine, ChevronDown, ChevronUp, Loader2, Plus, Search, ArrowUpDown } from "lucide-react";
import { LetterboxdImport } from "./letterboxd-import";
import React, { useEffect, useRef, useState, useTransition } from "react";
import type { TmdbResult } from "@/app/api/tmdb/search/route";
import { MediaCard } from "./media-card";

const CATEGORIES = ["Sitcom", "Anime", "Film", "Documentary", "Series", "Other"] as const;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function MediaGrid() {
  const items = useQuery(api.mediaList.list) ?? [];
  const addItem = useMutation(api.mediaList.create);
  const reorderItems = useMutation(api.mediaList.reorder);

  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [tmdbResults, setTmdbResults] = useState<TmdbResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selected, setSelected] = useState<TmdbResult | null>(null);
  const [overrideCategory, setOverrideCategory] = useState<typeof CATEGORIES[number] | "">("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [toWatchOpen, setToWatchOpen] = useState(true);
  const [watchedOpen, setWatchedOpen] = useState(true);
  const [toWatchSort, setToWatchSort] = useState<{ by: "date" | "alpha" | "score" | "runtime"; rev: boolean }>({ by: "date", rev: true });
  const [watchedSort, setWatchedSort] = useState<{ by: "date" | "alpha" | "score" | "runtime"; rev: boolean }>({ by: "date", rev: true });
  const watchedSectionRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounce(search, 350);

  useEffect(() => {
    if (!debouncedSearch.trim() || selected) { setTmdbResults([]); return; }
    setIsSearching(true);
    fetch(`/api/tmdb/search?q=${encodeURIComponent(debouncedSearch)}`)
      .then((r) => r.json())
      .then((data) => { setTmdbResults(Array.isArray(data) ? data : []); })
      .catch(() => setTmdbResults([]))
      .finally(() => setIsSearching(false));
  }, [debouncedSearch, selected]);

  function handleSelect(result: TmdbResult) {
    setSelected(result);
    setSearch(result.title);
    setOverrideCategory(result.mediaType);
    setTmdbResults([]);
  }

  async function handleAdd() {
    if (!search.trim()) return;
    const category = (overrideCategory || selected?.mediaType || "Other") as typeof CATEGORIES[number];
    startTransition(async () => {
      let genres: string[] | undefined;
      let director: string | undefined;
      let tmdbMediaType: string | undefined;
      let runtime: number | undefined;
      if (selected?.id) {
        const type = selected.mediaType === "Series" ? "tv" : "movie";
        try {
          const r = await fetch(`/api/tmdb/details?id=${selected.id}&type=${type}`);
          if (r.ok) {
            const d = await r.json();
            genres = d.genres?.length ? d.genres : undefined;
            director = d.director ?? undefined;
            runtime = d.runtime ?? undefined;
            tmdbMediaType = type;
          }
        } catch {
          /* ignore */
        }
      }
      await addItem({
        title: selected?.title ?? search.trim(),
        category,
        notes: notes.trim() || undefined,
        tmdbId: selected?.id,
        posterPath: selected?.posterUrl ?? undefined,
        overview: selected?.overview || undefined,
        voteAverage: selected?.voteAverage,
        genres,
        director,
        runtime,
        tmdbMediaType,
      });
      setSearch(""); setNotes(""); setSelected(null); setOverrideCategory(""); setShowForm(false);
    });
  }

  function handleReset() {
    setSearch(""); setNotes(""); setSelected(null); setOverrideCategory(""); setTmdbResults([]);
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const toWatch = items.filter((i) => !i.watchedAt);
    const oldIdx = toWatch.findIndex((i) => i._id === active.id);
    const newIdx = toWatch.findIndex((i) => i._id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    reorderItems({ orderedIds: arrayMove(toWatch, oldIdx, newIdx).map((i) => i._id) });
  }

  const rawToWatch = items.filter((i) => !i.watchedAt);
  const rawWatched = items.filter((i) => !!i.watchedAt);

  type MediaItem = (typeof items)[number];
  function sortItems(list: MediaItem[], sort: { by: "date" | "alpha" | "score" | "runtime"; rev: boolean }, isWatched: boolean): MediaItem[] {
    const arr = [...list];
    const mult = sort.rev ? -1 : 1;
    arr.sort((a, b) => {
      let cmp = 0;
      if (sort.by === "date") {
        cmp = isWatched
          ? (a.watchedAt ?? "").localeCompare(b.watchedAt ?? "")
          : (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      } else if (sort.by === "alpha") {
        cmp = (a.title ?? "").localeCompare(b.title ?? "", undefined, { sensitivity: "base" });
      } else if (sort.by === "score") {
        const sa = isWatched ? (a.userRating ?? 0) : (a.voteAverage ?? 0);
        const sb = isWatched ? (b.userRating ?? 0) : (b.voteAverage ?? 0);
        cmp = sa - sb;
      } else {
        cmp = (a.runtime ?? 0) - (b.runtime ?? 0);
      }
      return mult * cmp;
    });
    return arr;
  }

  const toWatch = sortItems(rawToWatch, toWatchSort, false);
  const watched = sortItems(rawWatched, watchedSort, true);

  const SORT_OPTS = [
    { key: "date" as const, label: "Date" },
    { key: "alpha" as const, label: "A-Z" },
    { key: "score" as const, label: "Score" },
    { key: "runtime" as const, label: "Runtime" },
  ];

  function SortControls({ sort, setSort, isWatched }: { sort: typeof toWatchSort; setSort: React.Dispatch<React.SetStateAction<typeof toWatchSort>>; isWatched: boolean }) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {SORT_OPTS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSort((s) => ({ ...s, by: key, rev: s.by === key ? !s.rev : false }))}
            className={`px-2 py-0.5 rounded text-[10px] ${sort.by === key ? "bg-violet-600/60 text-white" : "text-[hsl(0_0%_45%)] hover:text-[hsl(0_0%_65%)]"}`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setSort((s) => ({ ...s, rev: !s.rev }))}
          className="p-0.5 rounded text-[hsl(0_0%_40%)] hover:text-white"
          title={sort.rev ? "Azalan" : "Artan"}
        >
          <ArrowUpDown className={`w-3 h-3 ${sort.rev ? "rotate-180" : ""}`} />
        </button>
      </div>
    );
  }

  return (
    <div>
      {showForm ? (
        <div className="mb-6 bg-[hsl(0_0%_7%)] border border-[hsl(263_90%_60%/0.3)] rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-medium text-white">Add to Watch List</h3>

          {/* Search input */}
          <div className="relative">
            <div className="flex items-center gap-2 bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] rounded-lg px-3 py-2 focus-within:border-[hsl(263_90%_60%/0.5)]">
              <Search className="w-3.5 h-3.5 text-[hsl(0_0%_35%)] shrink-0" />
              <input
                ref={searchRef} autoFocus
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
                onKeyDown={(e) => e.key === "Enter" && !tmdbResults.length && handleAdd()}
                placeholder="Search TMDB or type a title…"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-[hsl(0_0%_30%)] outline-none"
              />
              {isSearching && <Loader2 className="w-3.5 h-3.5 animate-spin text-[hsl(0_0%_35%)] shrink-0" />}
              {selected && (
                <button onClick={handleReset} className="text-xs text-[hsl(0_0%_35%)] hover:text-white transition-colors">
                  Clear
                </button>
              )}
            </div>

            {/* TMDB dropdown */}
            {tmdbResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[hsl(0_0%_9%)] border border-[hsl(0_0%_18%)] rounded-xl shadow-2xl z-20 overflow-hidden">
                {tmdbResults.map((r) => (
                  <button key={r.id} onClick={() => handleSelect(r)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[hsl(0_0%_13%)] transition-colors text-left">
                    {r.posterUrl ? (
                      <img src={r.posterUrl} alt="" className="w-8 h-12 object-cover rounded shrink-0" />
                    ) : (
                      <div className="w-8 h-12 bg-[hsl(0_0%_14%)] rounded shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{r.title}</p>
                      <p className="text-xs text-[hsl(0_0%_40%)]">{r.mediaType} {r.year && `· ${r.year}`} {r.voteAverage > 0 && `· ★ ${r.voteAverage}`}</p>
                      {r.overview && <p className="text-xs text-[hsl(0_0%_35%)] truncate mt-0.5">{r.overview}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected result preview */}
          {selected && (
            <div className="flex gap-3 bg-[hsl(0_0%_9%)] rounded-lg p-3">
              {selected.posterUrl && (
                <img src={selected.posterUrl} alt={selected.title} className="w-10 h-14 object-cover rounded shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{selected.title}</p>
                <p className="text-xs text-[hsl(0_0%_45%)]">{selected.year} · ★ {selected.voteAverage}</p>
                {selected.overview && <p className="text-xs text-[hsl(0_0%_40%)] mt-1 line-clamp-2">{selected.overview}</p>}
              </div>
            </div>
          )}

          {/* Category override + notes */}
          <div className="flex gap-3">
            <select
              value={overrideCategory || (selected?.mediaType ?? "Other")}
              onChange={(e) => setOverrideCategory(e.target.value as typeof CATEGORIES[number])}
              className="bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] rounded-lg px-3 py-2 text-sm text-white outline-none"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Personal notes (optional)"
              className="flex-1 bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[hsl(0_0%_30%)] outline-none" />
          </div>

          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!search.trim() || isPending}
              className="px-4 py-2 rounded-lg bg-[hsl(263_90%_60%)] hover:bg-[hsl(263_90%_65%)] disabled:opacity-40 text-white text-sm font-medium">Add</button>
            <button onClick={() => { setShowForm(false); handleReset(); }}
              className="px-4 py-2 rounded-lg bg-[hsl(0_0%_12%)] hover:bg-[hsl(0_0%_15%)] text-[hsl(0_0%_60%)] text-sm">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="mb-6 flex gap-2 flex-wrap">
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 text-sm text-[hsl(0_0%_40%)] hover:text-white border border-dashed border-[hsl(0_0%_18%)] hover:border-[hsl(0_0%_30%)] rounded-xl px-4 py-3 transition-all">
            <Plus className="w-4 h-4" /> Add to Watch List
          </button>
          <LetterboxdImport />
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-20 text-[hsl(0_0%_30%)]">
          <p className="text-sm">No titles yet. Search above or use Brain Dump.</p>
        </div>
      ) : (
        <>
          {toWatch.length > 0 && (
            <div className="mb-2 rounded-xl border border-[hsl(0_0%_15%)] bg-[hsl(0_0%_8%)] overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-transparent">
                <button
                  onClick={() => setToWatchOpen((o) => !o)}
                  className="flex-1 flex items-center justify-between text-left hover:bg-[hsl(0_0%_10%)] -m-2 p-2 rounded transition-colors"
                >
                  <span className="text-sm font-medium text-white">To watch</span>
                  <span className="text-xs text-[hsl(0_0%_45%)]">{toWatch.length} items</span>
                  {toWatchOpen ? <ChevronUp className="w-4 h-4 text-[hsl(0_0%_40%)]" /> : <ChevronDown className="w-4 h-4 text-[hsl(0_0%_40%)]" />}
                </button>
                <SortControls sort={toWatchSort} setSort={setToWatchSort} isWatched={false} />
              </div>
              {toWatchOpen && (
                <div className="px-4 pb-4 pt-0 border-t border-[hsl(0_0%_12%)]">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={toWatch.map((i) => i._id)} strategy={rectSortingStrategy}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-3">
                        {toWatch.map((item) => <MediaCard key={item._id} item={item} />)}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </div>
          )}
          {watched.length > 0 && (
            <>
              <div className="relative my-6 py-4 border-t border-b border-[hsl(0_0%_18%)] bg-[hsl(0_0%_6%)] flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[hsl(0_0%_12%)] to-transparent opacity-50" />
                <button
                  onClick={() => { watchedSectionRef.current?.scrollIntoView({ behavior: "smooth" }); setWatchedOpen(true); }}
                  className="relative flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600/60 hover:bg-violet-600/80 text-white text-sm font-medium transition-colors"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  Go to watched
                </button>
              </div>
              <div ref={watchedSectionRef} className="rounded-xl border border-[hsl(0_0%_15%)] bg-[hsl(0_0%_8%)] overflow-hidden scroll-mt-4">
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-transparent">
                  <button
                    onClick={() => setWatchedOpen((o) => !o)}
                    className="flex-1 flex items-center justify-between text-left hover:bg-[hsl(0_0%_10%)] -m-2 p-2 rounded transition-colors"
                  >
                    <span className="text-sm font-medium text-white">Watched</span>
                    <span className="text-xs text-[hsl(0_0%_45%)]">{watched.length} items</span>
                    {watchedOpen ? <ChevronUp className="w-4 h-4 text-[hsl(0_0%_40%)]" /> : <ChevronDown className="w-4 h-4 text-[hsl(0_0%_40%)]" />}
                  </button>
                  <SortControls sort={watchedSort} setSort={setWatchedSort} isWatched={true} />
                </div>
                {watchedOpen && (
                  <div className="px-4 pb-4 pt-0 border-t border-[hsl(0_0%_12%)]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-3">
                      {watched.map((item) => <MediaCard key={item._id} item={item} />)}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

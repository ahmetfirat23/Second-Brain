"use client";

import { api } from "../../../convex/_generated/api";
import { useAction, useMutation } from "convex/react";
import { FolderUp, Loader2, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { parseCSV } from "@/lib/parse-csv";

const TARGET_FILES = ["ratings.csv", "reviews.csv", "watched.csv", "watchlist.csv"];

type ImportItem = {
  title: string;
  year: string;
  rating: number | undefined;
  watchedDate: string | undefined;
  review: string | undefined;
  isWatchlist: boolean;
};

function findColumn(header: string[], names: string[]): number {
  const normalized = header.map((h) => h.toLowerCase().replace(/\s+/g, ""));
  for (const name of names) {
    const idx = normalized.findIndex((h) => h === name.toLowerCase().replace(/\s+/g, ""));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseLetterboxdFile(
  text: string,
  type: "reviews" | "ratings" | "watched" | "watchlist"
): ImportItem[] {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];

  const header = rows[0];
  if (type === "reviews") console.log(`[Letterboxd] parseCSV returned ${rows.length} rows for reviews`);
  console.log(`[Letterboxd] ${type} headers:`, header);

  const nameIdx = findColumn(header, ["name", "title"]);
  if (nameIdx === -1) return [];

  const yearIdx = findColumn(header, ["year"]);
  const ratingIdx = findColumn(header, ["rating"]);
  const dateIdx = findColumn(header, ["date"]);
  const watchedIdx = findColumn(header, ["watcheddate", "watched"]);
  const reviewIdx = type === "reviews" ? findColumn(header, ["review"]) : -1;

  console.log(`[Letterboxd] ${type} column indices — name:${nameIdx} year:${yearIdx} rating:${ratingIdx} date:${dateIdx} watched:${watchedIdx} review:${reviewIdx}`);
  if (type === "reviews" && rows.length > 1) {
    console.log(`[Letterboxd] rows[1]:`, rows[1]);
    console.log(`[Letterboxd] rows[2]:`, rows[2]);
    console.log(`[Letterboxd] rows[3]:`, rows[3]);
  }

  const result: ImportItem[] = [];
  let skippedNoTitle = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const title = row[nameIdx]?.trim();
    if (!title) { skippedNoTitle++; continue; }

    const year = yearIdx >= 0 ? row[yearIdx]?.trim() ?? "" : "";
    let rating: number | undefined;
    const ratingRaw = ratingIdx >= 0 ? row[ratingIdx]?.trim() : "";
    if (ratingRaw) {
      const r = parseFloat(ratingRaw);
      if (!isNaN(r) && r >= 0 && r <= 5) {
        rating = Math.round(r * 2); // 0.5-5 -> 1-10
      }
    }
    const watchedDate =
      watchedIdx >= 0
        ? row[watchedIdx]?.trim().slice(0, 10)
        : dateIdx >= 0
          ? row[dateIdx]?.trim().slice(0, 10)
          : undefined;
    const review = reviewIdx >= 0 ? row[reviewIdx]?.trim() : undefined;

    result.push({
      title,
      year,
      rating,
      watchedDate,
      review,
      isWatchlist: type === "watchlist",
    });
  }
  if (type === "reviews") console.log(`[Letterboxd] reviews loop: ${result.length} added, ${skippedNoTitle} skipped (no title)`);
  return result;
}

function mergeLetterboxdData(
  reviews: ImportItem[],
  ratings: ImportItem[],
  watched: ImportItem[],
  watchlist: ImportItem[]
): ImportItem[] {
  const key = (i: ImportItem) => `${i.title.toLowerCase().trim()}|${i.year}`;
  const map = new Map<string, ImportItem>();

  for (const item of reviews) {
    map.set(key(item), { ...item, isWatchlist: false });
  }
  for (const item of ratings) {
    const k = key(item);
    if (!map.has(k)) map.set(k, { ...item, isWatchlist: false });
    else {
      const existing = map.get(k)!;
      if (existing.rating == null && item.rating != null) {
        map.set(k, { ...existing, rating: item.rating });
      }
      if (existing.watchedDate == null && item.watchedDate != null) {
        map.set(k, { ...existing, watchedDate: item.watchedDate });
      }
    }
  }
  for (const item of watched) {
    const k = key(item);
    if (!map.has(k)) map.set(k, { ...item, isWatchlist: false });
    else {
      const existing = map.get(k)!;
      if (existing.watchedDate == null && item.watchedDate != null) {
        map.set(k, { ...existing, watchedDate: item.watchedDate });
      }
    }
  }

  const watchedKeys = new Set(map.keys());
  for (const item of watchlist) {
    const k = key(item);
    if (!watchedKeys.has(k)) {
      map.set(k, { ...item, isWatchlist: true });
    }
  }

  return Array.from(map.values());
}

export function LetterboxdImport() {
  const [show, setShow] = useState(false);
  const [parsed, setParsed] = useState<ImportItem[] | null>(null);
  const [stats, setStats] = useState({ watched: 0, watchlist: 0, reviews: 0 });
  const [sources, setSources] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const bulkCreate = useMutation(api.mediaList.bulkCreate);
  const scheduleEnrichment = useAction(api.tmdbEnrichment.scheduleEnrichmentForImported);
  const [isPending, startTransition] = useTransition();

  async function readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result ?? ""));
      r.onerror = () => reject(new Error("Read failed"));
      r.readAsText(file, "UTF-8");
    });
  }

  function handleFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;

    const byName = new Map<string, File>();
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const base = f.name.toLowerCase();
      if (TARGET_FILES.includes(base)) byName.set(base, f);
      const inPath = (f as File & { webkitRelativePath?: string }).webkitRelativePath?.split("/").pop()?.toLowerCase();
      if (inPath && TARGET_FILES.includes(inPath)) byName.set(inPath, f);
    }

    const found = Array.from(byName.keys());
    if (found.length === 0) {
      toast.error("No Letterboxd CSV files found. Need ratings.csv, reviews.csv, watched.csv, or watchlist.csv");
      e.target.value = "";
      return;
    }

    (async () => {
      const reviews: ImportItem[] = [];
      const ratings: ImportItem[] = [];
      const watched: ImportItem[] = [];
      const watchlist: ImportItem[] = [];

      if (byName.has("reviews.csv")) {
        const text = await readFile(byName.get("reviews.csv")!);
        reviews.push(...parseLetterboxdFile(text, "reviews"));
      }
      if (byName.has("ratings.csv")) {
        const text = await readFile(byName.get("ratings.csv")!);
        ratings.push(...parseLetterboxdFile(text, "ratings"));
      }
      if (byName.has("watched.csv")) {
        const text = await readFile(byName.get("watched.csv")!);
        watched.push(...parseLetterboxdFile(text, "watched"));
      }
      if (byName.has("watchlist.csv")) {
        const text = await readFile(byName.get("watchlist.csv")!);
        watchlist.push(...parseLetterboxdFile(text, "watchlist"));
      }

      console.log(`[Letterboxd] raw reviews parsed: ${reviews.length}, with text: ${reviews.filter(r => r.review?.trim()).length}`);
      console.log(`[Letterboxd] sample review keys:`, reviews.slice(0, 3).map(r => `"${r.title}"|${r.year} → review: ${r.review ? r.review.slice(0,30) : "NONE"}`));
      console.log(`[Letterboxd] sample rating keys:`, ratings.slice(0, 3).map(r => `"${r.title}"|${r.year}`));

      const merged = mergeLetterboxdData(reviews, ratings, watched, watchlist);
      const watchedItems = merged.filter((m) => !m.isWatchlist);
      const watchlistItems = merged.filter((m) => m.isWatchlist);

      const reviewCount = merged.filter((m) => m.review?.trim()).length;
      console.log(`[Letterboxd] after merge: ${merged.length} total, ${reviewCount} with reviews`);
      console.log(`[Letterboxd] merged items with reviews:`, merged.filter(m => m.review?.trim()).map(m => `"${m.title}"|${m.year}`));
      setParsed(merged);
      setStats({ watched: watchedItems.length, watchlist: watchlistItems.length, reviews: reviewCount });
      setSources(found);
      setShow(true);
    })();

    e.target.value = "";
  }

  function handleImport() {
    if (!parsed || parsed.length === 0) return;
    startTransition(async () => {
      const items = parsed.map((p) => ({
        title: p.title,
        year: p.year || undefined,
        category: "Film" as const,
        watchedAt: p.isWatchlist ? undefined : (p.watchedDate ? `${p.watchedDate}T12:00:00.000Z` : undefined),
        watchedNotes: p.review || undefined,
        userRating: p.rating,
      }));
      const result = await bulkCreate({ items });
      const ids = result?.ids ?? [];
      const skipped = result?.skipped ?? 0;
      if (ids.length) {
        await scheduleEnrichment({ mediaIds: ids });
      }
      const skipNote = skipped > 0 ? ` · ${skipped} duplicate${skipped !== 1 ? "s" : ""} skipped` : "";
      toast.success(
        `Imported ${ids.length} item${ids.length !== 1 ? "s" : ""}${skipNote}`,
        { description: ids.length ? "TMDB metadata updating in background." : undefined }
      );
      setParsed(null);
      setShow(false);
      setSources([]);
    });
  }

  function handleCancel() {
    setParsed(null);
    setShow(false);
    setSources([]);
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        {...({ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
        multiple
        onChange={handleFolder}
        className="hidden"
      />
      <button
        onClick={() => fileRef.current?.click()}
        className="hidden lg:flex items-center gap-2 text-sm text-[hsl(0_0%_75%)] hover:text-violet-400 border border-dashed border-[hsl(0_0%_28%)] hover:border-violet-500/50 rounded-xl px-4 py-3 transition-all"
        title="Upload your Letterboxd export folder"
      >
        <FolderUp className="w-4 h-4" />
        Import Letterboxd
      </button>

      {show && parsed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={handleCancel}>
          <div
            className="bg-[hsl(0_0%_13%)] border border-[hsl(0_0%_28%)] rounded-xl p-4 w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white">Import from Letterboxd</h3>
              <button onClick={handleCancel} className="p-1 rounded hover:bg-[hsl(0_0%_14%)] text-[hsl(0_0%_75%)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[hsl(0_0%_72%)] mb-1">
              Found: {sources.join(", ")}
            </p>
            <p className="text-xs text-[hsl(0_0%_72%)] mb-3">
              {stats.watched} watched · {stats.watchlist} to watch
              {stats.reviews > 0
                ? <span className="text-amber-400"> · {stats.reviews} with reviews</span>
                : <span className="text-red-400"> · no reviews found {sources.includes("reviews.csv") ? "" : "(reviews.csv missing)"}</span>
              }
            </p>
            <div className="flex-1 overflow-y-auto mb-4 max-h-48 rounded-lg bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_13%)] p-2">
              {parsed.slice(0, 25).map((p, i) => (
                <div key={i} className="text-xs text-[hsl(0_0%_70%)] py-0.5 truncate flex gap-2">
                  <span className="truncate">{p.title}{p.year ? ` (${p.year})` : ""}</span>
                  {p.rating != null && <span className="text-amber-400 shrink-0">★ {p.rating}/10</span>}
                  {p.review?.trim() && <span className="text-emerald-400 shrink-0">review</span>}
                  {p.isWatchlist && <span className="text-sky-400 shrink-0">to watch</span>}
                </div>
              ))}
              {parsed.length > 25 && (
                <div className="text-xs text-[hsl(0_0%_72%)] py-1">… and {parsed.length - 25} more</div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleImport}
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Import {parsed.length} items
              </button>
              <button onClick={handleCancel} className="px-4 py-2 rounded-lg bg-[hsl(0_0%_12%)] text-[hsl(0_0%_75%)] text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { readFileSync } from "fs";

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { cell += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cell += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ",") { row.push(cell.trim()); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && next === "\n") i++;
        row.push(cell.trim()); cell = "";
        if (row.some(r => r.length > 0)) rows.push(row);
        row = [];
      } else { cell += c; }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some(r => r.length > 0)) rows.push(row);
  }
  return rows;
}

function findColumn(header, names) {
  const normalized = header.map(h => h.toLowerCase().replace(/\s+/g, ""));
  for (const name of names) {
    const idx = normalized.findIndex(h => h === name.toLowerCase().replace(/\s+/g, ""));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseFile(text, type) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const header = rows[0];
  const nameIdx = findColumn(header, ["name", "title"]);
  if (nameIdx === -1) return [];
  const yearIdx = findColumn(header, ["year"]);
  const ratingIdx = findColumn(header, ["rating"]);
  const dateIdx = findColumn(header, ["date"]);
  const watchedIdx = findColumn(header, ["watcheddate", "watched date", "watched"]);
  const reviewIdx = type === "reviews" ? findColumn(header, ["review"]) : -1;

  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const title = row[nameIdx]?.trim();
    if (!title) continue;
    const year = yearIdx >= 0 ? row[yearIdx]?.trim() ?? "" : "";
    let rating;
    const ratingRaw = ratingIdx >= 0 ? row[ratingIdx]?.trim() : "";
    if (ratingRaw) {
      const r = parseFloat(ratingRaw);
      if (!isNaN(r) && r >= 0 && r <= 5) rating = Math.round(r * 2);
    }
    const watchedDate = watchedIdx >= 0
      ? row[watchedIdx]?.trim().slice(0, 10)
      : dateIdx >= 0 ? row[dateIdx]?.trim().slice(0, 10) : undefined;
    const review = reviewIdx >= 0 ? row[reviewIdx]?.trim() || undefined : undefined;
    result.push({ title, year, rating, watchedDate, review, isWatchlist: type === "watchlist" });
  }
  return result;
}

function merge(reviews, ratings, watched, watchlist) {
  const key = i => `${i.title.toLowerCase().trim()}|${i.year}`;
  const map = new Map();
  for (const item of reviews) map.set(key(item), { ...item, isWatchlist: false });
  for (const item of ratings) {
    const k = key(item);
    if (!map.has(k)) { map.set(k, { ...item, isWatchlist: false }); continue; }
    const ex = map.get(k);
    const patch = { ...ex };
    if (ex.rating == null && item.rating != null) patch.rating = item.rating;
    if (ex.watchedDate == null && item.watchedDate != null) patch.watchedDate = item.watchedDate;
    map.set(k, patch);
  }
  for (const item of watched) {
    const k = key(item);
    if (!map.has(k)) { map.set(k, { ...item, isWatchlist: false }); continue; }
    const ex = map.get(k);
    if (ex.watchedDate == null && item.watchedDate != null) map.set(k, { ...ex, watchedDate: item.watchedDate });
  }
  const watchedKeys = new Set(map.keys());
  for (const item of watchlist) {
    const k = key(item);
    if (!watchedKeys.has(k)) map.set(k, { ...item, isWatchlist: true });
  }
  return Array.from(map.values());
}

const dir = "/Users/afg/Documents/SecondBrain/letter";
const reviews = parseFile(readFileSync(`${dir}/reviews.csv`, "utf-8"), "reviews");
const ratings = parseFile(readFileSync(`${dir}/ratings.csv`, "utf-8"), "ratings");
const watched = parseFile(readFileSync(`${dir}/watched.csv`, "utf-8"), "watched");
const watchlist = parseFile(readFileSync(`${dir}/watchlist.csv`, "utf-8"), "watchlist");

console.log(`Parsed: ${reviews.length} reviews, ${ratings.length} ratings, ${watched.length} watched, ${watchlist.length} watchlist`);
console.log(`Reviews with text: ${reviews.filter(r => r.review).length}`);

const merged = merge(reviews, ratings, watched, watchlist);
console.log(`Merged: ${merged.length} total, ${merged.filter(m => m.review).length} with reviews`);

const items = merged.map(p => ({
  title: p.title,
  year: p.year || undefined,
  category: "Film",
  watchedAt: p.isWatchlist ? undefined : (p.watchedDate ? `${p.watchedDate}T12:00:00.000Z` : undefined),
  watchedNotes: p.review || undefined,
  userRating: p.rating,
}));

// Write to a temp JSON file for convex run
import { writeFileSync } from "fs";
writeFileSync("/tmp/letterboxd_items.json", JSON.stringify({ items }, null, 2));
console.log(`Written ${items.length} items to /tmp/letterboxd_items.json`);
console.log(`Sample item with review:`, items.find(i => i.watchedNotes));

import { readFileSync } from "fs";

function parseCSV(text) {
  const rows = []; let row = []; let cell = ""; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { cell += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cell += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(cell.trim()); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && next === '\n') i++;
        row.push(cell.trim()); cell = '';
        if (row.some(r => r.length > 0)) rows.push(row);
        row = [];
      } else { cell += c; }
    }
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell.trim()); if (row.some(r => r.length > 0)) rows.push(row); }
  return rows;
}

function col(header, names) {
  const n = header.map(h => h.toLowerCase().replace(/\s+/g, ''));
  for (const name of names) { const i = n.findIndex(h => h === name.toLowerCase().replace(/\s+/g, '')); if (i >= 0) return i; }
  return -1;
}

function parseFile(text, type) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const h = rows[0];
  const nameIdx = col(h, ['name','title']); if (nameIdx === -1) return [];
  const yearIdx = col(h, ['year']), ratingIdx = col(h, ['rating']), dateIdx = col(h, ['date']);
  const watchedIdx = col(h, ['watcheddate','watched date','watched']);
  const reviewIdx = type === 'reviews' ? col(h, ['review']) : -1;
  return rows.slice(1).flatMap(row => {
    const title = row[nameIdx]?.trim(); if (!title) return [];
    const year = yearIdx >= 0 ? row[yearIdx]?.trim() ?? '' : '';
    let rating; const rr = ratingIdx >= 0 ? row[ratingIdx]?.trim() : '';
    if (rr) { const r = parseFloat(rr); if (!isNaN(r) && r >= 0 && r <= 5) rating = Math.round(r * 2); }
    const watchedDate = watchedIdx >= 0 ? row[watchedIdx]?.trim().slice(0,10) : dateIdx >= 0 ? row[dateIdx]?.trim().slice(0,10) : undefined;
    const review = reviewIdx >= 0 ? row[reviewIdx]?.trim() || undefined : undefined;
    return [{ title, year, rating, watchedDate, review, isWatchlist: type === 'watchlist' }];
  });
}

const dir = '/Users/afg/Documents/SecondBrain/letter';
const reviews = parseFile(readFileSync(`${dir}/reviews.csv`, 'utf-8'), 'reviews');
const ratings = parseFile(readFileSync(`${dir}/ratings.csv`, 'utf-8'), 'ratings');
const watched = parseFile(readFileSync(`${dir}/watched.csv`, 'utf-8'), 'watched');
const watchlist = parseFile(readFileSync(`${dir}/watchlist.csv`, 'utf-8'), 'watchlist');

const key = i => `${i.title.toLowerCase().trim()}|${i.year}`;
const map = new Map();
for (const item of reviews) map.set(key(item), { ...item, isWatchlist: false });
for (const item of ratings) {
  const k = key(item);
  if (!map.has(k)) { map.set(k, { ...item, isWatchlist: false }); continue; }
  const ex = map.get(k), patch = { ...ex };
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
for (const item of watchlist) { const k = key(item); if (!watchedKeys.has(k)) map.set(k, { ...item, isWatchlist: true }); }

const merged = Array.from(map.values());
const items = merged.map(p => ({
  title: p.title, year: p.year || undefined, category: 'Film',
  watchedAt: p.isWatchlist ? undefined : (p.watchedDate ? `${p.watchedDate}T12:00:00.000Z` : undefined),
  watchedNotes: p.review || undefined, userRating: p.rating,
}));

console.log(`Total: ${items.length}, with reviews: ${items.filter(i => i.watchedNotes).length}`);

// Call Convex bulkCreate in batches of 100 via HTTP API
const CONVEX_URL = 'https://hearty-canary-360.convex.cloud';
const BATCH = 100;
let totalImported = 0, totalSkipped = 0;

for (let i = 0; i < items.length; i += BATCH) {
  const batch = items.slice(i, i + BATCH);
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'mediaList:bulkCreate', args: { items: batch }, adminKey: process.env.CONVEX_ADMIN_KEY }),
  });
  if (!res.ok) { console.error('Batch failed:', await res.text()); continue; }
  const data = await res.json();
  const ids = data.value?.ids ?? [];
  const skipped = data.value?.skipped ?? 0;
  totalImported += ids.length; totalSkipped += skipped;
  console.log(`Batch ${Math.floor(i/BATCH)+1}: imported ${ids.length}, skipped ${skipped}`);
}

console.log(`Done. Total imported: ${totalImported}, skipped: ${totalSkipped}`);

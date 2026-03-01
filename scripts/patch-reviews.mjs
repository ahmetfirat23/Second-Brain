import { readFileSync } from "fs";
import { execSync } from "child_process";

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cell.trim()); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && next === "\n") i++;
        row.push(cell.trim()); cell = "";
        if (row.some(r => r.length > 0)) rows.push(row);
        row = [];
      } else cell += c;
    }
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell.trim()); if (row.some(r => r.length > 0)) rows.push(row); }
  return rows;
}

function findCol(header, names) {
  const norm = header.map(h => h.toLowerCase().replace(/\s+/g, ""));
  for (const n of names) { const i = norm.indexOf(n.toLowerCase().replace(/\s+/g, "")); if (i >= 0) return i; }
  return -1;
}

function parseFile(text, type) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const h = rows[0];
  const nameI = findCol(h, ["name", "title"]);
  const yearI = findCol(h, ["year"]);
  const ratingI = findCol(h, ["rating"]);
  const watchedI = findCol(h, ["watcheddate", "watcheddate"]);
  const dateI = findCol(h, ["date"]);
  const reviewI = type === "reviews" ? findCol(h, ["review"]) : -1;
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const title = r[nameI]?.trim();
    if (!title) continue;
    const year = yearI >= 0 ? r[yearI]?.trim() || "" : "";
    const ratingRaw = ratingI >= 0 ? r[ratingI]?.trim() : "";
    let rating;
    if (ratingRaw) { const v = parseFloat(ratingRaw); if (!isNaN(v) && v >= 0 && v <= 5) rating = Math.round(v * 2); }
    const watchedDate = watchedI >= 0 ? r[watchedI]?.trim().slice(0, 10) :
      dateI >= 0 ? r[dateI]?.trim().slice(0, 10) : undefined;
    const review = reviewI >= 0 ? r[reviewI]?.trim() || undefined : undefined;
    result.push({ title, year, rating, watchedDate, review });
  }
  return result;
}

// Find the latest letterboxd zip on the Desktop
let dir;
try {
  const zips = execSync("ls /Users/afg/Desktop/letterboxd-*.zip 2>/dev/null | sort | tail -1", { encoding: "utf-8" }).trim();
  if (zips) {
    execSync(`cd /tmp && rm -rf lb_extract && mkdir lb_extract && unzip -o "${zips}" -d lb_extract > /dev/null 2>&1`);
    dir = "/tmp/lb_extract";
  }
} catch { /* ignore */ }
if (!dir) { console.error("No letterboxd zip found on Desktop"); process.exit(1); }

const reviews = parseFile(readFileSync(dir + "/reviews.csv", "utf-8"), "reviews");
console.log(`Parsed ${reviews.length} reviews from reviews.csv`);

// Build items with reviews only
const items = reviews
  .filter(p => p.review)
  .map(p => ({
    title: p.title,
    year: p.year || undefined,
    watchedNotes: p.review,
    userRating: p.rating,
    watchedAt: p.watchedDate ? p.watchedDate + "T12:00:00.000Z" : undefined,
  }));

console.log(`${items.length} items with review text to patch`);

const BATCH = 30;
let totalPatched = 0, totalSkipped = 0;

for (let i = 0; i < items.length; i += BATCH) {
  const batch = items.slice(i, i + BATCH);
  const json = JSON.stringify({ items: batch });
  const escaped = json.replace(/'/g, "'\\''");
  try {
    const pushFlag = i === 0 ? "--push --typecheck disable" : "--no-push";
    const out = execSync(
      `cd /Users/afg/Documents/SecondBrain && npx convex run mediaList:patchReviews '${escaped}' ${pushFlag}`,
      { encoding: "utf-8", timeout: 60000 }
    );
    const result = JSON.parse(out.trim());
    totalPatched += result.patched ?? 0;
    totalSkipped += result.skipped ?? 0;
    process.stdout.write(`\rBatch ${Math.floor(i / BATCH) + 1}/${Math.ceil(items.length / BATCH)}: ${totalPatched} patched`);
  } catch (e) {
    console.error(`\nBatch ${Math.floor(i / BATCH) + 1} failed:`, e.message?.slice(0, 300));
  }
}

console.log(`\nDone. Patched: ${totalPatched}, Skipped: ${totalSkipped}`);

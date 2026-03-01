import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Auto-tidy runs every 3 hours on Convex cloud
// Requires: npx convex env set GROK_API_KEY=... TMDB_API_KEY=...
crons.interval(
  "auto-tidy pending brain dumps",
  { hours: 3 },
  internal.ai.tidyAllPending
);

// Taste summary for movie chat: weekly (168 hours)
crons.interval(
  "generate taste summary",
  { hours: 168 },
  internal.ai.generateTasteSummaryCron
);

// TMDB enrichment: daily, fetch metadata for items without tmdbId
crons.interval(
  "enrich media without TMDB",
  { hours: 24 },
  internal.tmdbEnrichment.enrichMissingTmdbCron
);

export default crons;

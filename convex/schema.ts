import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  brainDumps: defineTable({
    title: v.optional(v.string()),
    content: v.string(),
    tidiedContent: v.optional(v.string()),
    tidiedAt: v.optional(v.string()),
    noMerge: v.optional(v.boolean()),
  }),

  mediaList: defineTable({
    title: v.string(),
    sourceDumpId: v.optional(v.id("brainDumps")),
    category: v.union(
      v.literal("Sitcom"),
      v.literal("Anime"),
      v.literal("Film"),
      v.literal("Documentary"),
      v.literal("Series"),
      v.literal("Other")
    ),
    notes: v.optional(v.string()),
    aiConsensus: v.optional(v.string()),
    sortOrder: v.number(),
    tmdbId: v.optional(v.number()),
    tmdbMediaType: v.optional(v.string()),
    posterPath: v.optional(v.string()),
    overview: v.optional(v.string()),
    voteAverage: v.optional(v.number()),
    genres: v.optional(v.array(v.string())),
    director: v.optional(v.string()),
    runtime: v.optional(v.number()),
    watchedAt: v.optional(v.string()),
    watchedNotes: v.optional(v.string()),
    userRating: v.optional(v.number()),
  }),

  tasteSummary: defineTable({
    summary: v.string(),
    updatedAt: v.string(),
  }),

  chatContext: defineTable({
    pinnedMediaIds: v.array(v.id("mediaList")),
    autoInclude: v.optional(v.string()),
    autoIncludeLimit: v.optional(v.number()),
    autoIncludeEnabled: v.optional(v.boolean()),
    includeRatings: v.optional(v.boolean()),
    useLimitMode: v.optional(v.boolean()),
  }),

  deadlines: defineTable({
    task: v.string(),
    sourceDumpId: v.optional(v.id("brainDumps")),
    deadline: v.string(),
    category: v.union(
      v.literal("Job"),
      v.literal("Lecture"),
      v.literal("Other")
    ),
  }),

  vault: defineTable({
    title: v.string(),
    sourceDumpId: v.optional(v.id("brainDumps")),
    url: v.string(),
    urgency: v.number(),
  }),

  knowledgeCards: defineTable({
    front: v.string(),
    sourceDumpId: v.optional(v.id("brainDumps")),
    back: v.string(),
    easeFactor: v.number(),
    interval: v.number(),
    repetitions: v.number(),
    nextReview: v.string(),
  }),

  apiUsage: defineTable({
    source: v.string(), // "movie-chat" | "brain-dump-parse" | "brain-dump-tidy" | "ai-tidy" | "ai-fanout" | "ai-taste"
    provider: v.string(), // "grok"
    inputTokens: v.number(),
    outputTokens: v.number(),
    estimatedCostUsd: v.number(), // stored as decimal e.g. 0.0015
  }),

  dailyTodos: defineTable({
    date: v.string(),
    text: v.string(),
    done: v.boolean(),
    urgency: v.number(),
    sortOrder: v.number(),
  }).index("by_date", ["date"]),

  goals: defineTable({
    title: v.string(),
    sourceDumpId: v.optional(v.id("brainDumps")),
    description: v.optional(v.string()),
    importance: v.union(
      v.literal(1),
      v.literal(2),
      v.literal(3),
      v.literal(4),
      v.literal(5)
    ),
    size: v.union(v.literal("short"), v.literal("medium"), v.literal("long")),
    status: v.union(
      v.literal("not_started"),
      v.literal("in_progress"),
      v.literal("done")
    ),
    startedAt: v.optional(v.string()),
    doneAt: v.optional(v.string()),
    sortOrder: v.number(),
  }),
});

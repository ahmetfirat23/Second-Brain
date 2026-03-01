/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as apiUsage from "../apiUsage.js";
import type * as brainDumps from "../brainDumps.js";
import type * as chatContext from "../chatContext.js";
import type * as clearData from "../clearData.js";
import type * as crons from "../crons.js";
import type * as dailyTodos from "../dailyTodos.js";
import type * as deadlines from "../deadlines.js";
import type * as goals from "../goals.js";
import type * as knowledgeCards from "../knowledgeCards.js";
import type * as mediaList from "../mediaList.js";
import type * as search from "../search.js";
import type * as tasteSummary from "../tasteSummary.js";
import type * as tmdbEnrichment from "../tmdbEnrichment.js";
import type * as vault from "../vault.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  apiUsage: typeof apiUsage;
  brainDumps: typeof brainDumps;
  chatContext: typeof chatContext;
  clearData: typeof clearData;
  crons: typeof crons;
  dailyTodos: typeof dailyTodos;
  deadlines: typeof deadlines;
  goals: typeof goals;
  knowledgeCards: typeof knowledgeCards;
  mediaList: typeof mediaList;
  search: typeof search;
  tasteSummary: typeof tasteSummary;
  tmdbEnrichment: typeof tmdbEnrichment;
  vault: typeof vault;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

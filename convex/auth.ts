import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Throws if the user is not authenticated. Use at the start of every
 * public Convex function that should only be callable by signed-in users.
 */
export async function requireUserIdentity(ctx: QueryCtx | MutationCtx | ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized: you must be signed in to perform this action");
  }
  return identity;
}

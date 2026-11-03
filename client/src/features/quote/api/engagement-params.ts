export type QuoteEngagementPeriod = "today" | "yesterday" | "week" | "all";

/** Optional narrowing of the recent-engagement feed (server-side). */
export interface QuoteEngagementScope {
  /** Only quotes on the current user's own deals, whatever their role. */
  mine?: boolean;
  period?: QuoteEngagementPeriod;
}

export interface QuoteEngagementParams {
  limit: number;
  mine?: "true";
  period?: QuoteEngagementPeriod;
}

/** Query params for GET /api/v2/quotes/engagement/recent. With no scope this is `{ limit }` only. */
export function buildEngagementParams(limit: number, scope: QuoteEngagementScope = {}): QuoteEngagementParams {
  const params: QuoteEngagementParams = { limit };
  if (scope.mine) params.mine = "true";
  if (scope.period) params.period = scope.period;
  return params;
}

/** Cache key tail for the engagement query: one entry per limit + scope. */
export function engagementKey(limit: number, scope: QuoteEngagementScope = {}) {
  return ["engagement", buildEngagementParams(limit, scope)] as const;
}

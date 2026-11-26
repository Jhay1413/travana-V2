/** Pure rules for the portal Deals page: which list shows, how the filters interact, and which empty state applies. */

export type DealsTab = "latest" | "for-you";

/** Home links here with ?tab=for-you from the "For you" section's View all. */
export function initialDealsTab(search: string): DealsTab {
  return new URLSearchParams(search).get("tab") === "for-you" ? "for-you" : "latest";
}

export interface DealFilters {
  tag: string | undefined;
  country: string | undefined;
  /** Narrow "Latest deals" to the customer's saved travel interests (server-side). */
  matchInterests: boolean;
}

export const DEFAULT_DEAL_FILTERS: DealFilters = { tag: undefined, country: undefined, matchInterests: true };

/**
 * An explicit tag is a request for that exact tag. AND-ing it with the interest filter can silently zero out
 * results for a tag outside the customer's saved interests, so choosing a tag turns the interest filter off and
 * clearing the tag restores the interests-first default. Choosing the same tag again clears it.
 */
export function selectTag(filters: DealFilters, tag: string): DealFilters {
  const next = filters.tag === tag ? undefined : tag;
  return { ...filters, tag: next, matchInterests: next === undefined };
}

export function selectCountry(filters: DealFilters, country: string | undefined): DealFilters {
  return { ...filters, country: country || undefined };
}

/** A tag or country is chosen (the interest filter is its own toggle). */
export function hasExplicitFilter(filters: DealFilters): boolean {
  return Boolean(filters.tag || filters.country);
}

/** Whether the list is currently narrowed to the customer's interests: only on "Latest deals", and only when they have some. */
export function isFilteringByInterests(tab: DealsTab, hasInterests: boolean, filters: DealFilters): boolean {
  return tab === "latest" && hasInterests && filters.matchInterests;
}

export type DealsEmptyKind = "for-you" | "filters" | "interests" | "none";

/** Which "nothing here" message to show, most specific first. */
export function dealsEmptyKind(tab: DealsTab, filteringByInterests: boolean, filters: DealFilters): DealsEmptyKind {
  if (tab === "for-you") return "for-you";
  if (hasExplicitFilter(filters)) return "filters";
  if (filteringByInterests) return "interests";
  return "none";
}

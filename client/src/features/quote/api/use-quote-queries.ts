import { keepPreviousData, useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { quoteApi } from "@/api";
import type { FreeQuoteStatusCounts, QuoteEngagementRow, SocialStatusFilter } from "./quote.api";
import { engagementKey, type QuoteEngagementScope } from "./engagement-params";
import type { EnrichedQuote, QuoteFilters, PortalStatus } from "@/features/quote/types";

export const quoteKeys = {
  all: ["quotes"] as const,
  lists: () => [...quoteKeys.all, "list"] as const,
  list: (filters?: QuoteFilters) => [...quoteKeys.lists(), filters] as const,
  freeQuotes: () => [...quoteKeys.all, "free"] as const,
  details: () => [...quoteKeys.all, "detail"] as const,
  detail: (id: string) => [...quoteKeys.details(), id] as const,
  recentEngagement: (limit: number, scope?: QuoteEngagementScope) =>
    [...quoteKeys.all, ...engagementKey(limit, scope)] as const,
};

export function useRecentQuoteEngagement(
  limit = 10,
  options?: { enabled?: boolean; scope?: QuoteEngagementScope; keepPrevious?: boolean },
) {
  return useQuery<QuoteEngagementRow[]>({
    queryKey: quoteKeys.recentEngagement(limit, options?.scope),
    queryFn: () => quoteApi.getRecentClientEngagement(limit, options?.scope),
    enabled: options?.enabled ?? true,
    placeholderData: options?.keepPrevious ? keepPreviousData : undefined,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });
}

export function useQuotes(filters?: QuoteFilters) {
  return useQuery<EnrichedQuote[]>({
    queryKey: quoteKeys.list(filters),
    queryFn: () => quoteApi.getAll(filters),
  });
}

export function useFreeQuotesInfinite(
  pageSize: number = 12,
  scheduledOnly = false,
  scheduleFilter = "none",
  search = "",
  rangeStart = "",
  rangeEnd = "",
  unscheduledOnly = false,
  showOnPortal = false,
  portalStatus: PortalStatus = "all",
  tags: string[] = [],
  options?: { enabled?: boolean },
  socialStatus?: SocialStatusFilter,
) {
  return useInfiniteQuery({
    queryKey: [...quoteKeys.freeQuotes(), scheduledOnly ? "scheduled" : "all", scheduleFilter, search, rangeStart, rangeEnd, unscheduledOnly, showOnPortal, portalStatus, tags, socialStatus ?? null],
    queryFn: ({ pageParam = 0 }) => quoteApi.getFreeQuotes(pageParam, pageSize, scheduledOnly, scheduleFilter, search, rangeStart, rangeEnd, unscheduledOnly, showOnPortal, portalStatus, tags, socialStatus),
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 0 as number,
    enabled: options?.enabled ?? true,
  });
}

export function useFreeQuoteStatusCounts(search = "", tags: string[] = []) {
  return useQuery<FreeQuoteStatusCounts>({
    queryKey: [...quoteKeys.freeQuotes(), "status-counts", search, tags],
    queryFn: () => quoteApi.getFreeQuoteStatusCounts(search, tags),
  });
}

export function useQuote(id: string) {
  return useQuery<EnrichedQuote>({
    queryKey: quoteKeys.detail(id),
    queryFn: () => quoteApi.getById(id),
    enabled: !!id,
  });
}

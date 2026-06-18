import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { quoteApi } from "@/api";
import type { QuoteEngagementRow } from "./quote.api";
import type { EnrichedQuote, QuoteFilters } from "@/features/quote/types";

export const quoteKeys = {
  all: ["quotes"] as const,
  lists: () => [...quoteKeys.all, "list"] as const,
  list: (filters?: QuoteFilters) => [...quoteKeys.lists(), filters] as const,
  freeQuotes: () => [...quoteKeys.all, "free"] as const,
  details: () => [...quoteKeys.all, "detail"] as const,
  detail: (id: string) => [...quoteKeys.details(), id] as const,
  recentEngagement: (limit: number) => [...quoteKeys.all, "engagement", limit] as const,
};

export function useRecentQuoteEngagement(limit = 10, options?: { enabled?: boolean }) {
  return useQuery<QuoteEngagementRow[]>({
    queryKey: quoteKeys.recentEngagement(limit),
    queryFn: () => quoteApi.getRecentClientEngagement(limit),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
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
  options?: { enabled?: boolean },
) {
  return useInfiniteQuery({
    queryKey: [...quoteKeys.freeQuotes(), scheduledOnly ? "scheduled" : "all", scheduleFilter, search, rangeStart, rangeEnd],
    queryFn: ({ pageParam = 0 }) => quoteApi.getFreeQuotes(pageParam, pageSize, scheduledOnly, scheduleFilter, search, rangeStart, rangeEnd),
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 0 as number,
    enabled: options?.enabled ?? true,
  });
}

export function useQuote(id: string) {
  return useQuery<EnrichedQuote>({
    queryKey: quoteKeys.detail(id),
    queryFn: () => quoteApi.getById(id),
    enabled: !!id,
  });
}

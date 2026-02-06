import { useQuery } from "@tanstack/react-query";
import { quoteApi } from "@/api";
import type { Quote, QuoteFull, QuoteFilters } from "@/types/quote";

export const quoteKeys = {
  all: ["quotes"] as const,
  lists: () => [...quoteKeys.all, "list"] as const,
  list: (filters?: QuoteFilters) => [...quoteKeys.lists(), filters] as const,
  details: () => [...quoteKeys.all, "detail"] as const,
  detail: (id: string) => [...quoteKeys.details(), id] as const,
  full: (id: string) => [...quoteKeys.all, "full", id] as const,
};

export function useQuotes(filters?: QuoteFilters) {
  return useQuery<Quote[]>({
    queryKey: quoteKeys.list(filters),
    queryFn: () => quoteApi.getAll(filters),
  });
}

export function useQuote(id: string) {
  return useQuery<Quote>({
    queryKey: quoteKeys.detail(id),
    queryFn: () => quoteApi.getById(id),
    enabled: !!id,
  });
}

export function useQuoteFull(id: string) {
  return useQuery<QuoteFull>({
    queryKey: quoteKeys.full(id),
    queryFn: () => quoteApi.getFull(id),
    enabled: !!id,
  });
}

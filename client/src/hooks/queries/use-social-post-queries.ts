import { useQuery } from "@tanstack/react-query";
import { socialPostApi } from "@/api/endpoints/social-post.api";
import type { TravelDeal } from "@/api/endpoints/social-post.api";

export const socialPostKeys = {
  all: ["socialPosts"] as const,
  byQuote: (quoteId: string) => [...socialPostKeys.all, "quote", quoteId] as const,
};

export function useTravelDeal(quoteId: string, enabled = true) {
  return useQuery<TravelDeal | null>({
    queryKey: socialPostKeys.byQuote(quoteId),
    queryFn: () => socialPostApi.getByQuoteId(quoteId),
    enabled: !!quoteId && enabled,
  });
}

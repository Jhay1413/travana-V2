import { useQuery } from "@tanstack/react-query";
import { socialPostApi } from "@/api/endpoints/social-post.api";
import type { TravelDeal, UploadedMedia } from "@/api/endpoints/social-post.api";

export const socialPostKeys = {
  all: ["socialPosts"] as const,
  byQuote: (quoteId: string) => [...socialPostKeys.all, "quote", quoteId] as const,
  media: (id: string) => [...socialPostKeys.all, "media", id] as const,
};

export function useTravelDeal(quoteId: string, enabled = true) {
  return useQuery<TravelDeal | null>({
    queryKey: socialPostKeys.byQuote(quoteId),
    queryFn: () => socialPostApi.getByQuoteId(quoteId),
    enabled: !!quoteId && enabled,
  });
}

export function usePostMedia(dealId: string | null | undefined, enabled = true) {
  return useQuery<{ media: UploadedMedia[]; postContent: string }>({
    queryKey: socialPostKeys.media(dealId ?? ""),
    queryFn: () => socialPostApi.getMedia(dealId!),
    enabled: !!dealId && enabled,
  });
}

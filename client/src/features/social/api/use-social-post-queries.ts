import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { socialPostApi, type QuoteImageSource, type TravelDeal, type UploadedMedia } from "./social-post.api";

export const socialPostKeys = {
  all: ["socialPosts"] as const,
  byQuote: (quoteId: string) => [...socialPostKeys.all, "quote", quoteId] as const,
  media: (id: string) => [...socialPostKeys.all, "media", id] as const,
  quoteImages: (quoteId: string) => [...socialPostKeys.all, "quote-images", quoteId] as const,
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

/** Imperative, always-fresh load of a quote's post, written through the query cache. */
export function useFetchTravelDeal() {
  const queryClient = useQueryClient();
  return useCallback(
    (quoteId: string): Promise<TravelDeal | null> =>
      queryClient.fetchQuery({
        queryKey: socialPostKeys.byQuote(quoteId),
        queryFn: () => socialPostApi.getByQuoteId(quoteId),
        staleTime: 0,
      }),
    [queryClient],
  );
}

/** Imperative, always-fresh load of a post's media. */
export function useFetchPostMedia() {
  const queryClient = useQueryClient();
  return useCallback(
    (dealId: string): Promise<{ media: UploadedMedia[]; postContent: string }> =>
      queryClient.fetchQuery({
        queryKey: socialPostKeys.media(dealId),
        queryFn: () => socialPostApi.getMedia(dealId),
        staleTime: 0,
      }),
    [queryClient],
  );
}

/** Imperative, always-fresh load of a quote's image sources. */
export function useFetchQuoteImages() {
  const queryClient = useQueryClient();
  return useCallback(
    (quoteId: string): Promise<QuoteImageSource[]> =>
      queryClient.fetchQuery({
        queryKey: socialPostKeys.quoteImages(quoteId),
        queryFn: () => socialPostApi.getQuoteImages(quoteId),
        staleTime: 0,
      }),
    [queryClient],
  );
}

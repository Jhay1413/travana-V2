import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { socialPostApi, type GeneratePostParams, type SchedulePostResult, type TravelDeal } from "./social-post.api";
import { socialPostKeys } from "./use-social-post-queries";
import { quoteKeys } from "@/features/quote/api/use-quote-queries";

/** Auto-upscaling swaps quote images for sharper copies, so cached quotes are stale. */
function invalidateQuotesIfUpscaled(queryClient: QueryClient, deal: SchedulePostResult): void {
  if (deal.autoUpscale && deal.autoUpscale.upscaled.length > 0) {
    queryClient.invalidateQueries({ queryKey: quoteKeys.all });
  }
}

export function useGeneratePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GeneratePostParams) => socialPostApi.generate(data),
    onSuccess: (deal) => {
      queryClient.setQueryData(socialPostKeys.byQuote(deal.quote_id), deal);
    },
  });
}

export function useSavePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TravelDeal> }) =>
      socialPostApi.update(id, data),
    onSuccess: (deal) => {
      queryClient.setQueryData(socialPostKeys.byQuote(deal.quote_id), deal);
    },
  });
}

export function useScheduleOnOnlySocials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
      socialPostApi.scheduleOnOnlySocials(id, formData),
    onSuccess: (deal) => {
      queryClient.setQueryData(socialPostKeys.byQuote(deal.quote_id), deal);
      queryClient.invalidateQueries({ queryKey: quoteKeys.freeQuotes() });
    },
  });
}

export function useRescheduleOnOnlySocials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
      socialPostApi.rescheduleOnOnlySocials(id, formData),
    onSuccess: (deal) => {
      queryClient.setQueryData(socialPostKeys.byQuote(deal.quote_id), deal);
      queryClient.invalidateQueries({ queryKey: quoteKeys.freeQuotes() });
      queryClient.invalidateQueries({ queryKey: socialPostKeys.media(deal.id) });
    },
  });
}

export function useUploadMedia() {
  return useMutation({
    mutationFn: (files: File[]) => socialPostApi.uploadMedia(files),
  });
}

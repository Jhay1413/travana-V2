import { useMutation, useQueryClient } from "@tanstack/react-query";
import { socialPostApi } from "@/api/endpoints/social-post.api";
import type { GeneratePostParams, TravelDeal } from "@/api/endpoints/social-post.api";
import { socialPostKeys } from "@/hooks/queries/use-social-post-queries";

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
    },
  });
}

export function useUploadMedia() {
  return useMutation({
    mutationFn: (files: File[]) => socialPostApi.uploadMedia(files),
  });
}

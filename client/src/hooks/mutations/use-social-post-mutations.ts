import { useMutation, useQueryClient } from "@tanstack/react-query";
import { socialPostApi } from "@/api/endpoints/social-post.api";
import type { GeneratePostParams, TravelDeal, UploadedMedia } from "@/api/endpoints/social-post.api";
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
    mutationFn: ({ id, postSchedule, images }: { id: string; postSchedule: string; images?: number[] }) =>
      socialPostApi.scheduleOnOnlySocials(id, postSchedule, images),
    onSuccess: (deal) => {
      queryClient.setQueryData(socialPostKeys.byQuote(deal.quote_id), deal);
    },
  });
}

export function useRescheduleOnOnlySocials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, postSchedule, images = [] }: { id: string; postSchedule: string; images?: number[] }) =>
      socialPostApi.rescheduleOnOnlySocials(id, postSchedule, images),
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

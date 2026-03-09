import { useMutation, useQueryClient } from "@tanstack/react-query";
import { quoteApi } from "@/api";
import { quoteKeys } from "@/hooks/queries";

export function useUploadQuoteImages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, files }: { quoteId: string; files: File[] }) =>
      quoteApi.uploadImages(quoteId, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
    },
  });
}

export function useAddQuoteImageUrls() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, urls }: { quoteId: string; urls: string[] }) =>
      quoteApi.addImages(quoteId, urls),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
    },
  });
}

export function useDeleteQuoteImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, imageId }: { quoteId: string; imageId: string }) =>
      quoteApi.removeImage(quoteId, imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
    },
  });
}

export function useSetPrimaryQuoteImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, imageId }: { quoteId: string; imageId: string }) =>
      quoteApi.setPrimaryImage(quoteId, imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
    },
  });
}

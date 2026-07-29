import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { quoteApi } from "@/api";
import { quoteKeys, transactionKeys, bookingKeys, clientKeys } from "@/hooks/queries";

function invalidateQuoteImageRelated(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: quoteKeys.all });
  queryClient.invalidateQueries({ queryKey: transactionKeys.all });
  queryClient.invalidateQueries({ queryKey: bookingKeys.all });
  queryClient.invalidateQueries({ queryKey: clientKeys.all });
}

export function useUploadQuoteImages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, files }: { quoteId: string; files: File[] }) =>
      quoteApi.uploadImages(quoteId, files),
    onSuccess: () => invalidateQuoteImageRelated(queryClient),
  });
}

export function useAddQuoteImageUrls() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, urls }: { quoteId: string; urls: string[] }) =>
      quoteApi.addImages(quoteId, urls),
    onSuccess: () => invalidateQuoteImageRelated(queryClient),
  });
}

export function useDeleteQuoteImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, imageId }: { quoteId: string; imageId: string }) =>
      quoteApi.removeImage(quoteId, imageId),
    onSuccess: () => invalidateQuoteImageRelated(queryClient),
  });
}

export function useSetPrimaryQuoteImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, imageId }: { quoteId: string; imageId: string }) =>
      quoteApi.setPrimaryImage(quoteId, imageId),
    onSuccess: () => invalidateQuoteImageRelated(queryClient),
  });
}

export function useReorderQuoteImages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, ...order }: { quoteId: string; imageIds?: string[]; imageUrls?: string[] }) =>
      quoteApi.reorderImages(quoteId, order),
    onSuccess: () => invalidateQuoteImageRelated(queryClient),
  });
}

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { bookingApi } from "@/api";
import { bookingKeys, transactionKeys, quoteKeys, clientKeys } from "@/hooks/queries";

function invalidateBookingImageRelated(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: bookingKeys.all });
  queryClient.invalidateQueries({ queryKey: transactionKeys.all });
  queryClient.invalidateQueries({ queryKey: quoteKeys.all });
  queryClient.invalidateQueries({ queryKey: clientKeys.all });
}

export function useUploadBookingImages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, files }: { bookingId: string; files: File[] }) =>
      bookingApi.uploadImages(bookingId, files),
    onSuccess: () => invalidateBookingImageRelated(queryClient),
  });
}

export function useAddBookingImageUrls() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, urls }: { bookingId: string; urls: string[] }) =>
      bookingApi.addImages(bookingId, urls),
    onSuccess: () => invalidateBookingImageRelated(queryClient),
  });
}

export function useDeleteBookingImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, imageId }: { bookingId: string; imageId: string }) =>
      bookingApi.removeImage(bookingId, imageId),
    onSuccess: () => invalidateBookingImageRelated(queryClient),
  });
}

export function useSetPrimaryBookingImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, imageId }: { bookingId: string; imageId: string }) =>
      bookingApi.setPrimaryImage(bookingId, imageId),
    onSuccess: () => invalidateBookingImageRelated(queryClient),
  });
}

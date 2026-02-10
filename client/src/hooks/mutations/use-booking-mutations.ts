import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bookingApi } from "@/api";
import { bookingKeys, transactionKeys, quoteKeys } from "@/hooks/queries";
import type { Booking } from "@/types/quote";

export function useConvertToBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, haysRef, supplierRef }: { quoteId: string; haysRef: string; supplierRef: string }) =>
      bookingApi.convertFromQuote(quoteId, haysRef, supplierRef),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}

export function useUpdateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Booking> }) =>
      bookingApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}

export function useDeleteBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bookingApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}

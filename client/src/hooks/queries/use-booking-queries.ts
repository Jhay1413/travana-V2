import { useQuery } from "@tanstack/react-query";
import { bookingApi } from "@/api";
import type { Booking } from "@/types/quote";

export const bookingKeys = {
  all: ["bookings"] as const,
  lists: () => [...bookingKeys.all, "list"] as const,
  list: () => [...bookingKeys.lists()] as const,
  details: () => [...bookingKeys.all, "detail"] as const,
  detail: (id: string) => [...bookingKeys.details(), id] as const,
  byTransaction: (txnId: string) => [...bookingKeys.all, "byTransaction", txnId] as const,
};

export function useBookings() {
  return useQuery<Booking[]>({
    queryKey: bookingKeys.list(),
    queryFn: () => bookingApi.getAll(),
  });
}

export function useBooking(id: string) {
  return useQuery<Booking>({
    queryKey: bookingKeys.detail(id),
    queryFn: () => bookingApi.getById(id),
    enabled: !!id,
  });
}

export function useBookingByTransaction(transactionId: string) {
  return useQuery<Booking>({
    queryKey: bookingKeys.byTransaction(transactionId),
    queryFn: () => bookingApi.getByTransactionId(transactionId),
    enabled: !!transactionId,
  });
}

import { useQuery } from "@tanstack/react-query";
import { bookingApi } from "@/api";
import type { UpsellRecord } from "@/types/booking";

export const bookingUpsellKeys = {
  all: ["booking-upsells"] as const,
  lists: () => [...bookingUpsellKeys.all, "list"] as const,
  list: (bookingId: string) => [...bookingUpsellKeys.lists(), bookingId] as const,
};

export function useBookingUpsells(bookingId: string) {
  return useQuery<UpsellRecord[]>({
    queryKey: bookingUpsellKeys.list(bookingId),
    queryFn: () => bookingApi.listUpsells(bookingId),
    enabled: !!bookingId,
  });
}

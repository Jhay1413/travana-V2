import { useQuery } from "@tanstack/react-query";
import type { PortalBookingDetail, PortalBookingListItem } from "@shared/portal-bookings";
import { getPortalToken, portalFetch, portalKeys, PortalApiError } from "@/hooks/use-portal-api";
import { PORTAL_ENDPOINTS } from "./portal-endpoints";

export const portalBookingKeys = {
  list: portalKeys.bookings,
  detail: (id: string) => ["portal", "booking", id] as const,
};

/** The signed-in customer's live bookings (LOST ones are never sent). */
export function usePortalBookingList() {
  return useQuery<PortalBookingListItem[], PortalApiError>({
    queryKey: portalBookingKeys.list,
    queryFn: () => portalFetch(PORTAL_ENDPOINTS.bookings),
    retry: false,
    enabled: !!getPortalToken(),
  });
}

/** One booking in full; a 404 (not theirs, or gone) is not retried. */
export function usePortalBooking(id: string) {
  return useQuery<PortalBookingDetail, PortalApiError>({
    queryKey: portalBookingKeys.detail(id),
    queryFn: () => portalFetch(PORTAL_ENDPOINTS.booking(id)),
    retry: false,
    enabled: !!id && !!getPortalToken(),
  });
}

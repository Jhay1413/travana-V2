import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PortalSummary } from "@shared/portal-summary";
import { getPortalToken, portalFetch, PortalApiError } from "@/hooks/use-portal-api";
import { PORTAL_ENDPOINTS } from "./portal-endpoints";

export const portalSummaryKey = ["portal", "summary"] as const;

/** Home's one-call summary for the signed-in customer. Fetched when Home opens; nothing polls. */
export function usePortalSummary() {
  return useQuery<PortalSummary, PortalApiError>({
    queryKey: portalSummaryKey,
    queryFn: () => portalFetch(PORTAL_ENDPOINTS.summary),
    retry: false,
    enabled: !!getPortalToken(),
    // An answer on a quote changes the counts, so Home always asks again when it opens.
    staleTime: 0,
    refetchOnMount: "always",
  });
}

/**
 * "I'm interested" on a deal. The server tells the agent once per customer and deal, so a repeat from another tab
 * or device is answered `alreadyTold` and sends nothing. Either way the deal is then in the summary's told list.
 */
export function usePortalDealInterest() {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; alreadyTold: boolean }, PortalApiError, string>({
    mutationFn: (dealId) => portalFetch(PORTAL_ENDPOINTS.dealInterest, { method: "POST", body: JSON.stringify({ dealId }) }),
    onSuccess: (_result, dealId) => {
      queryClient.setQueryData<PortalSummary>(portalSummaryKey, (old) =>
        old && !old.toldDealIds.includes(dealId) ? { ...old, toldDealIds: [...old.toldDealIds, dealId] } : old,
      );
    },
  });
}

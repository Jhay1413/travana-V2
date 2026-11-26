import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PortalQuoteAction, PortalQuoteDecision, PortalQuoteDetail, PortalQuoteListItem } from "@shared/portal-quotes";
import { getPortalToken, portalFetch, portalKeys, PortalApiError } from "@/hooks/use-portal-api";
import { portalSummaryKey } from "./use-portal-summary";
import { applyDecisionToDetail, applyDecisionToList } from "../lib/quote-decision";
import { PORTAL_ENDPOINTS } from "./portal-endpoints";

export const portalQuoteKeys = {
  list: portalKeys.quotes,
  detail: (token: string) => ["portal", "quote", token] as const,
};

/** The signed-in customer's quotes (also feeds the Trips badge and Home, which share this query). */
export function usePortalQuoteList() {
  return useQuery<PortalQuoteListItem[]>({
    queryKey: portalQuoteKeys.list,
    queryFn: () => portalFetch(PORTAL_ENDPOINTS.quotes),
    retry: false,
    enabled: !!getPortalToken(),
  });
}

/** The owner's quote that is now a booking (410 BOOKED): carries the booking's id when the server named exactly one. */
export class BookedQuoteError extends PortalApiError {
  constructor(message: string, readonly bookingId: string | null) {
    super(message, 410, "BOOKED");
  }
}

/** The booking id in a BOOKED answer's body, or null (the shared fetch keeps only the message and code). */
async function bookedBookingId(token: string): Promise<string | null> {
  try {
    const res = await fetch(PORTAL_ENDPOINTS.quote(token), { headers: { Authorization: `Bearer ${getPortalToken()}` } });
    const body = (await res.json()) as { bookingId?: unknown };
    return typeof body.bookingId === "string" ? body.bookingId : null;
  } catch {
    return null;
  }
}

/** One quote in full; a 404 (not theirs, or gone) is not retried. A booked quote fails with a BookedQuoteError. */
export function usePortalQuote(token: string) {
  return useQuery<PortalQuoteDetail, PortalApiError>({
    queryKey: portalQuoteKeys.detail(token),
    queryFn: async () => {
      try {
        return await portalFetch(PORTAL_ENDPOINTS.quote(token));
      } catch (err) {
        if (err instanceof PortalApiError && err.code === "BOOKED") throw new BookedQuoteError(err.message, await bookedBookingId(token));
        throw err;
      }
    },
    retry: false,
    enabled: !!token && !!getPortalToken(),
  });
}

export interface PortalQuoteActionInput {
  action: PortalQuoteAction;
  note?: string;
  reason?: string;
  wantsSimilar?: boolean;
}

/**
 * "I'm interested", "Not interested" and Undo. On success the answer is written into both the list and the
 * quote, so the card moves to "Not for you" (or back) without another fetch.
 */
export function usePortalQuoteAction(token: string, quoteId: string) {
  const queryClient = useQueryClient();
  return useMutation<{ decision: PortalQuoteDecision }, PortalApiError, PortalQuoteActionInput>({
    mutationFn: (input) => portalFetch(PORTAL_ENDPOINTS.quoteAction(token), { method: "POST", body: JSON.stringify(input) }),
    onSuccess: ({ decision }) => {
      queryClient.setQueryData<PortalQuoteListItem[]>(portalQuoteKeys.list, (old) => (old ? applyDecisionToList(old, quoteId, decision) : old));
      queryClient.setQueryData<PortalQuoteDetail>(portalQuoteKeys.detail(token), (old) => (old ? applyDecisionToDetail(old, decision) : old));
      // The Trips badge and Home's "quotes to consider" count come from the summary, which an answer changes.
      void queryClient.invalidateQueries({ queryKey: portalSummaryKey });
    },
  });
}

/** Logs that the customer opened the quote (the agent sees "viewed via the portal"); best-effort. */
export function useLogPortalQuoteOpened() {
  return useMutation<unknown, PortalApiError, string>({
    mutationFn: (token) => portalFetch(PORTAL_ENDPOINTS.quoteView(token), { method: "POST" }),
  });
}

/** Records a share on the public share endpoint (the agent is told the quote was shared); best-effort. */
export function useRecordQuoteShare() {
  return useMutation<unknown, Error, { token: string; method: string }>({
    mutationFn: async ({ token, method }) => {
      const res = await fetch(PORTAL_ENDPOINTS.quoteShare(token), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      if (!res.ok) throw new Error(`Share log failed: ${res.status}`);
      return res.json();
    },
  });
}

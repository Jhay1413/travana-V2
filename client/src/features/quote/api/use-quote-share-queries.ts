import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosClient from "@/api/client/axios-client";
import { QUOTE_SHARE_ENDPOINTS } from "@/api/endpoints";
import { dashboardKeys, organizationOverviewKeys, transactionKeys } from "@/hooks/queries";
import { quoteKeys } from "./use-quote-queries";

export interface QuoteClientViewEntry {
  id: string;
  viewerName: string;
  viewedAt: string;
  deviceType: string | null;
  browser: string | null;
}

export interface QuotePublicViewEntry {
  id: string;
  viewedAt: string;
  deviceType: string | null;
  browser: string | null;
}

export interface QuoteViewStats {
  totalViews: number;
  uniqueViews: number;
  publicViewCount: number;
  firstViewed: string | null;
  lastViewed: string | null;
  deviceBreakdown: Record<string, number>;
  clientViews: QuoteClientViewEntry[];
  publicViews: QuotePublicViewEntry[];
}

/** One of a client's quotes that has been opened, with its view activity. */
export interface ClientQuoteViewSummary {
  quoteId: string;
  title: string | null;
  travelDate: string | null;
  quoteStatus: string | null;
  viewCount: number;
  lastViewedAt: string;
  lastDevice: string | null;
}

export const quoteShareKeys = {
  views: (quoteId: string) => ["quote-views", quoteId] as const,
  clientViews: (clientId: string) => ["quote-views", "client", clientId] as const,
  customerActions: (quoteId: string) => ["quote-customer-actions", quoteId] as const,
};

export function useQuoteViews(quoteId: string) {
  return useQuery<QuoteViewStats>({
    queryKey: quoteShareKeys.views(quoteId),
    queryFn: async () => {
      const res = await axiosClient.get(QUOTE_SHARE_ENDPOINTS.views(quoteId));
      return res.data;
    },
    enabled: !!quoteId,
  });
}

/** Quotes a client has viewed, most recently viewed first. */
export function useClientQuoteViews(clientId: string) {
  return useQuery<ClientQuoteViewSummary[]>({
    queryKey: quoteShareKeys.clientViews(clientId),
    queryFn: async () => {
      const res = await axiosClient.get<ClientQuoteViewSummary[]>(QUOTE_SHARE_ENDPOINTS.clientViews(clientId));
      return res.data;
    },
    enabled: !!clientId,
  });
}

/** One action the customer took on the public quote page (newest first from the API). */
export interface QuoteCustomerActionEntry {
  id: string;
  quoteId: string;
  /** "accepted" or "changes_requested". */
  actionType: string;
  message: string | null;
  customerName: string | null;
  createdAt: string;
}

export function useQuoteCustomerActions(quoteId: string) {
  return useQuery<QuoteCustomerActionEntry[]>({
    queryKey: quoteShareKeys.customerActions(quoteId),
    queryFn: async () => {
      const res = await axiosClient.get<QuoteCustomerActionEntry[]>(QUOTE_SHARE_ENDPOINTS.customerActions(quoteId));
      return res.data;
    },
    enabled: !!quoteId,
  });
}

/** Channels the server accepts for PATCH /quote-share/:id/sent. */
export type QuoteSentVia = "link" | "sms" | "email" | "whatsapp";

/** Records that a quote was shared (first-sent date is kept by the server). */
export function useMarkQuoteSent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ quoteId, sentVia }: { quoteId: string; sentVia: QuoteSentVia }) => {
      await axiosClient.patch(QUOTE_SHARE_ENDPOINTS.sent(quoteId), { sentVia });
    },
    onSuccess: (_data, { quoteId }) => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      // "Quotes sent" counts on the dashboards move with this.
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      queryClient.invalidateQueries({ queryKey: organizationOverviewKeys.all });
    },
    // Best-effort bookkeeping: a 403 is expected for read-only users on deals
    // they don't own, and must not surface as an error after a successful share.
    onError: () => undefined,
  });
}

/** Generates (or returns the existing) public share token for a quote. */
export function useGenerateQuoteToken() {
  return useMutation({
    mutationFn: async (quoteId: string): Promise<string> => {
      const res = await axiosClient.post<{ token: string }>(QUOTE_SHARE_ENDPOINTS.generateToken(quoteId));
      return res.data.token;
    },
  });
}

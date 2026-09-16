import { useQuery } from "@tanstack/react-query";
import axiosClient from "@/api/client/axios-client";

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
      const res = await axiosClient.get(`/api/v2/quote-share/${quoteId}/views`);
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
      const res = await axiosClient.get<ClientQuoteViewSummary[]>(`/api/v2/quote-share/client/${clientId}/views`);
      return res.data;
    },
    enabled: !!clientId,
  });
}

export function useQuoteCustomerActions(quoteId: string) {
  return useQuery({
    queryKey: quoteShareKeys.customerActions(quoteId),
    queryFn: async () => {
      const res = await axiosClient.get(`/api/v2/quote-share/${quoteId}/customer-actions`);
      return res.data;
    },
    enabled: !!quoteId,
  });
}

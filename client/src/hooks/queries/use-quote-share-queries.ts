import { useQuery } from "@tanstack/react-query";
import axiosClient from "@/api/client/axios-client";

export interface QuoteViewEntry {
  id: string;
  viewedAt: string;
  deviceType: string | null;
  browser: string | null;
}

export interface QuoteViewStats {
  totalViews: number;
  uniqueViews: number;
  firstViewed: string | null;
  lastViewed: string | null;
  deviceBreakdown: Record<string, number>;
  views: QuoteViewEntry[];
}

export const quoteShareKeys = {
  views: (quoteId: string) => ["quote-views", quoteId] as const,
  customerActions: (quoteId: string) => ["quote-customer-actions", quoteId] as const,
};

export function useQuoteViews(quoteId: string) {
  return useQuery<QuoteViewStats>({
    queryKey: quoteShareKeys.views(quoteId),
    queryFn: async () => {
      const res = await axiosClient.get(`/api/quote-share/${quoteId}/views`);
      return res.data.data;
    },
    enabled: !!quoteId,
  });
}

export function useQuoteCustomerActions(quoteId: string) {
  return useQuery({
    queryKey: quoteShareKeys.customerActions(quoteId),
    queryFn: async () => {
      const res = await axiosClient.get(`/api/quote-share/${quoteId}/customer-actions`);
      return res.data.data;
    },
    enabled: !!quoteId,
  });
}

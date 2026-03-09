import { useQuery } from "@tanstack/react-query";
import axiosClient from "@/api/client/axios-client";

export const quoteShareKeys = {
  views: (quoteId: string) => ["quote-views", quoteId] as const,
  customerActions: (quoteId: string) => ["quote-customer-actions", quoteId] as const,
};

export function useQuoteViews(quoteId: string) {
  return useQuery({
    queryKey: quoteShareKeys.views(quoteId),
    queryFn: async () => {
      const res = await axiosClient.get(`/api/quote-share/${quoteId}/views`);
      return res.data;
    },
    enabled: !!quoteId,
  });
}

export function useQuoteCustomerActions(quoteId: string) {
  return useQuery({
    queryKey: quoteShareKeys.customerActions(quoteId),
    queryFn: async () => {
      const res = await axiosClient.get(`/api/quote-share/${quoteId}/customer-actions`);
      return res.data;
    },
    enabled: !!quoteId,
  });
}

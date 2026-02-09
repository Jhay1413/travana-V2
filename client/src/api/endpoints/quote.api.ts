import axiosClient from "../client/axios-client";
import type { Quote, QuoteFull, CreateQuoteData, QuoteFilters } from "@/types/quote";

export const quoteApi = {
  getAll: async (filters?: QuoteFilters): Promise<Quote[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.clientId) params.append("clientId", filters.clientId);
    const query = params.toString();
    const { data } = await axiosClient.get<Quote[]>(`/api/quotes${query ? `?${query}` : ""}`);
    return data;
  },

  getById: async (id: string): Promise<Quote> => {
    const { data } = await axiosClient.get<Quote>(`/api/quotes/${id}`);
    return data;
  },

  getFull: async (id: string): Promise<QuoteFull> => {
    const { data } = await axiosClient.get<QuoteFull>(`/api/quotes/${id}/full`);
    return data;
  },

  create: async (quoteData: CreateQuoteData): Promise<Quote> => {
    const { data } = await axiosClient.post<Quote>("/api/quotes", quoteData);
    return data;
  },

  update: async (id: string, quoteData: Partial<CreateQuoteData> & Record<string, any>): Promise<Quote> => {
    const { data } = await axiosClient.patch<Quote>(`/api/quotes/${id}`, quoteData);
    return data;
  },

  convertToBooking: async (id: string, haysReference: string, tourReference: string): Promise<Quote> => {
    const { data } = await axiosClient.post<Quote>(`/api/quotes/${id}/convert-to-booking`, { haysReference, tourReference });
    return data;
  },

  getAllTags: async (): Promise<string[]> => {
    const { data } = await axiosClient.get<string[]>("/api/quotes/tags");
    return data;
  },
};

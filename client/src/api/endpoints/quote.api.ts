import axiosClient from "../client/axios-client";
import type { Quote, CreateQuoteData, QuoteFilters } from "@/types/quote";

interface FreeQuotesResponse {
  quotes: any[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export const quoteApi = {
  getAll: async (filters?: QuoteFilters): Promise<Quote[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.transactionId) params.append("transactionId", filters.transactionId);
    const query = params.toString();
    const { data } = await axiosClient.get<Quote[]>(`/api/v2/quotes${query ? `?${query}` : ""}`);
    return data;
  },

  getFreeQuotes: async (page: number = 0, pageSize: number = 12, scheduledOnly = false, scheduleFilter = "none", search = "", rangeStart = "", rangeEnd = ""): Promise<FreeQuotesResponse> => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (scheduledOnly) params.set("scheduledOnly", "true");
    if (scheduledOnly && scheduleFilter !== "none") params.set("scheduleFilter", scheduleFilter);
    if (scheduledOnly && rangeStart) params.set("rangeStart", rangeStart);
    if (scheduledOnly && rangeEnd) params.set("rangeEnd", rangeEnd);
    if (search) params.set("search", search);
    const { data } = await axiosClient.get<FreeQuotesResponse>(`/api/v2/quotes/free?${params}`);
    return data;
  },

  getById: async (id: string): Promise<Quote> => {
    const { data } = await axiosClient.get<Quote>(`/api/v2/quotes/${id}`);
    return data;
  },

  create: async (quoteData: CreateQuoteData | FormData): Promise<Quote> => {
    const config = quoteData instanceof FormData ? { headers: { "Content-Type": "multipart/form-data" } } : {};
    const { data } = await axiosClient.post<Quote>("/api/v2/quotes", quoteData, config);
    return data;
  },

  createSocialPost: async (quoteData: Omit<CreateQuoteData, 'transaction_id'> | FormData): Promise<Quote> => {
    const config = quoteData instanceof FormData ? { headers: { "Content-Type": "multipart/form-data" } } : {};
    const { data } = await axiosClient.post<Quote>("/api/v2/quotes/social-post", quoteData, config);
    return data;
  },

  duplicate: async (quoteId: string, quoteData: Partial<CreateQuoteData> & Record<string, any>): Promise<Quote> => {
    const { data } = await axiosClient.post<Quote>(`/api/v2/quotes/${quoteId}/duplicate`, quoteData);
    return data;
  },

  update: async (id: string, quoteData: Partial<CreateQuoteData> & Record<string, any>): Promise<Quote> => {
    const { data } = await axiosClient.patch<Quote>(`/api/v2/quotes/${id}`, quoteData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/quotes/${id}`);
  },

  addFlight: async (quoteId: string, flightData: any): Promise<any> => {
    const { data } = await axiosClient.post(`/api/v2/quotes/${quoteId}/flights`, flightData);
    return data;
  },

  updateFlight: async (quoteId: string, flightId: string, flightData: any): Promise<any> => {
    const { data } = await axiosClient.patch(`/api/v2/quotes/${quoteId}/flights/${flightId}`, flightData);
    return data;
  },

  removeFlight: async (quoteId: string, flightId: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/quotes/${quoteId}/flights/${flightId}`);
  },

  addAccommodation: async (quoteId: string, accommodationData: any): Promise<any> => {
    const { data } = await axiosClient.post(`/api/v2/quotes/${quoteId}/accommodations`, accommodationData);
    return data;
  },

  updateAccommodation: async (quoteId: string, accommodationId: string, accommodationData: any): Promise<any> => {
    const { data } = await axiosClient.patch(`/api/v2/quotes/${quoteId}/accommodations/${accommodationId}`, accommodationData);
    return data;
  },

  removeAccommodation: async (quoteId: string, accommodationId: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/quotes/${quoteId}/accommodations/${accommodationId}`);
  },

  addTransfer: async (quoteId: string, transferData: any): Promise<any> => {
    const { data } = await axiosClient.post(`/api/v2/quotes/${quoteId}/transfers`, transferData);
    return data;
  },

  removeTransfer: async (quoteId: string, transferId: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/quotes/${quoteId}/transfers/${transferId}`);
  },

  addPassenger: async (quoteId: string, passengerData: any): Promise<any> => {
    const { data } = await axiosClient.post(`/api/v2/quotes/${quoteId}/passengers`, passengerData);
    return data;
  },

  removePassenger: async (quoteId: string, passengerId: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/quotes/${quoteId}/passengers/${passengerId}`);
  },

  addImages: async (quoteId: string, imageUrls: string[]): Promise<any> => {
    const { data } = await axiosClient.post(`/api/v2/quotes/${quoteId}/images`, { images: imageUrls });
    return data;
  },

  uploadImages: async (quoteId: string, files: File[]): Promise<any> => {
    const formData = new FormData();
    files.forEach(file => formData.append("images", file));
    const { data } = await axiosClient.post(`/api/v2/quotes/${quoteId}/images/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  removeImage: async (quoteId: string, imageId: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/quotes/${quoteId}/images/${imageId}`);
  },

  setPrimaryImage: async (quoteId: string, imageId: string): Promise<any> => {
    const { data } = await axiosClient.patch(`/api/v2/quotes/${quoteId}/images/${imageId}/primary`);
    return data;
  },

  // Tag management
  updateTags: async (quoteId: string, tags: string[]): Promise<Quote> => {
    const { data } = await axiosClient.put<Quote>(`/api/v2/quotes/${quoteId}/tags`, { tags });
    return data;
  },

  getTags: async (quoteId: string): Promise<string[]> => {
    const { data } = await axiosClient.get<string[]>(`/api/v2/quotes/${quoteId}/tags`);
    return data;
  },
};

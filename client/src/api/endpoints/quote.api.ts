import axiosClient from "../client/axios-client";
import type { Quote, CreateQuoteData, QuoteFilters } from "@/types/quote";

export const quoteApi = {
  getAll: async (filters?: QuoteFilters): Promise<Quote[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.transactionId) params.append("transactionId", filters.transactionId);
    const query = params.toString();
    const { data } = await axiosClient.get<Quote[]>(`/api/quotes${query ? `?${query}` : ""}`);
    return data;
  },

  getById: async (id: string): Promise<Quote> => {
    const { data } = await axiosClient.get<Quote>(`/api/quotes/${id}`);
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

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/quotes/${id}`);
  },

  addFlight: async (quoteId: string, flightData: any): Promise<any> => {
    const { data } = await axiosClient.post(`/api/quotes/${quoteId}/flights`, flightData);
    return data;
  },

  updateFlight: async (quoteId: string, flightId: string, flightData: any): Promise<any> => {
    const { data } = await axiosClient.patch(`/api/quotes/${quoteId}/flights/${flightId}`, flightData);
    return data;
  },

  removeFlight: async (quoteId: string, flightId: string): Promise<void> => {
    await axiosClient.delete(`/api/quotes/${quoteId}/flights/${flightId}`);
  },

  addAccommodation: async (quoteId: string, accommodationData: any): Promise<any> => {
    const { data } = await axiosClient.post(`/api/quotes/${quoteId}/accommodations`, accommodationData);
    return data;
  },

  updateAccommodation: async (quoteId: string, accommodationId: string, accommodationData: any): Promise<any> => {
    const { data } = await axiosClient.patch(`/api/quotes/${quoteId}/accommodations/${accommodationId}`, accommodationData);
    return data;
  },

  removeAccommodation: async (quoteId: string, accommodationId: string): Promise<void> => {
    await axiosClient.delete(`/api/quotes/${quoteId}/accommodations/${accommodationId}`);
  },

  addTransfer: async (quoteId: string, transferData: any): Promise<any> => {
    const { data } = await axiosClient.post(`/api/quotes/${quoteId}/transfers`, transferData);
    return data;
  },

  removeTransfer: async (quoteId: string, transferId: string): Promise<void> => {
    await axiosClient.delete(`/api/quotes/${quoteId}/transfers/${transferId}`);
  },

  addPassenger: async (quoteId: string, passengerData: any): Promise<any> => {
    const { data } = await axiosClient.post(`/api/quotes/${quoteId}/passengers`, passengerData);
    return data;
  },

  removePassenger: async (quoteId: string, passengerId: string): Promise<void> => {
    await axiosClient.delete(`/api/quotes/${quoteId}/passengers/${passengerId}`);
  },

  addImages: async (quoteId: string, imageUrls: string[]): Promise<any> => {
    const { data } = await axiosClient.post(`/api/quotes/${quoteId}/images`, { images: imageUrls });
    return data;
  },

  removeImage: async (quoteId: string, imageId: string): Promise<void> => {
    await axiosClient.delete(`/api/quotes/${quoteId}/images/${imageId}`);
  },

  setPrimaryImage: async (quoteId: string, imageId: string): Promise<any> => {
    const { data } = await axiosClient.patch(`/api/quotes/${quoteId}/images/${imageId}/primary`);
    return data;
  },
};

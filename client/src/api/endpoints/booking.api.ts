import axiosClient from "../client/axios-client";
import type { Booking } from "@/types/quote";

export const bookingApi = {
  getAll: async (): Promise<Booking[]> => {
    const { data } = await axiosClient.get<Booking[]>("/api/v2/bookings");
    return data;
  },

  getById: async (id: string): Promise<Booking> => {
    const { data } = await axiosClient.get<Booking>(`/api/v2/bookings/${id}`);
    return data;
  },

  getByTransactionId: async (transactionId: string): Promise<Booking> => {
    const { data } = await axiosClient.get<Booking>(`/api/v2/bookings/transaction/${transactionId}`);
    return data;
  },

  convertFromQuote: async (quoteId: string, haysRef: string, supplierRef: string): Promise<Booking> => {
    const { data } = await axiosClient.post<Booking>(`/api/v2/bookings/convert/${quoteId}`, { haysRef, supplierRef });
    return data;
  },

  create: async (bookingData: Partial<Booking>): Promise<Booking> => {
    const { data } = await axiosClient.post<Booking>("/api/v2/bookings", bookingData);
    return data;
  },

  update: async (id: string, bookingData: Partial<Booking>): Promise<Booking> => {
    const { data } = await axiosClient.patch<Booking>(`/api/v2/bookings/${id}`, bookingData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/bookings/${id}`);
  },

  addFlight: async (bookingId: string, flightData: any): Promise<any> => {
    const { data } = await axiosClient.post(`/api/v2/bookings/${bookingId}/flights`, flightData);
    return data;
  },

  removeFlight: async (bookingId: string, flightId: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/bookings/${bookingId}/flights/${flightId}`);
  },

  addAccommodation: async (bookingId: string, accommodationData: any): Promise<any> => {
    const { data } = await axiosClient.post(`/api/v2/bookings/${bookingId}/accommodations`, accommodationData);
    return data;
  },

  removeAccommodation: async (bookingId: string, accommodationId: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/bookings/${bookingId}/accommodations/${accommodationId}`);
  },
};

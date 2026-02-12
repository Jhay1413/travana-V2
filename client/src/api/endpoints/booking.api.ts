import axiosClient from "../client/axios-client";
import type { Booking } from "@/types/quote";

export const bookingApi = {
  getAll: async (): Promise<Booking[]> => {
    const { data } = await axiosClient.get<Booking[]>("/api/bookings");
    return data;
  },

  getById: async (id: string): Promise<Booking> => {
    const { data } = await axiosClient.get<Booking>(`/api/bookings/${id}`);
    return data;
  },

  getByTransactionId: async (transactionId: string): Promise<Booking> => {
    const { data } = await axiosClient.get<Booking>(`/api/bookings/transaction/${transactionId}`);
    return data;
  },

  convertFromQuote: async (quoteId: string, haysRef: string, supplierRef: string): Promise<Booking> => {
    const { data } = await axiosClient.post<Booking>(`/api/bookings/convert/${quoteId}`, { haysRef, supplierRef });
    return data;
  },

  create: async (bookingData: Partial<Booking>): Promise<Booking> => {
    const { data } = await axiosClient.post<Booking>("/api/bookings", bookingData);
    return data;
  },

  update: async (id: string, bookingData: Partial<Booking>): Promise<Booking> => {
    const { data } = await axiosClient.patch<Booking>(`/api/bookings/${id}`, bookingData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/bookings/${id}`);
  },

  addFlight: async (bookingId: string, flightData: any): Promise<any> => {
    const { data } = await axiosClient.post(`/api/bookings/${bookingId}/flights`, flightData);
    return data;
  },

  removeFlight: async (bookingId: string, flightId: string): Promise<void> => {
    await axiosClient.delete(`/api/bookings/${bookingId}/flights/${flightId}`);
  },

  addAccommodation: async (bookingId: string, accommodationData: any): Promise<any> => {
    const { data } = await axiosClient.post(`/api/bookings/${bookingId}/accommodations`, accommodationData);
    return data;
  },

  removeAccommodation: async (bookingId: string, accommodationId: string): Promise<void> => {
    await axiosClient.delete(`/api/bookings/${bookingId}/accommodations/${accommodationId}`);
  },
};

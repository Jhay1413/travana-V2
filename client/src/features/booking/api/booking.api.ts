import axiosClient from "@/api/client/axios-client";
import type { Booking } from "@/features/quote/types";
import type { UpsellPayload, UpsellRecord } from "@/features/booking/types";

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

  addImages: async (bookingId: string, imageUrls: string[]): Promise<any> => {
    const { data } = await axiosClient.post(`/api/v2/bookings/${bookingId}/images`, { images: imageUrls });
    return data;
  },

  uploadImages: async (bookingId: string, files: File[]): Promise<any> => {
    const formData = new FormData();
    files.forEach(file => formData.append("images", file));
    const { data } = await axiosClient.post(`/api/v2/bookings/${bookingId}/images/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  removeImage: async (bookingId: string, imageId: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/bookings/${bookingId}/images/${imageId}`);
  },

  setPrimaryImage: async (bookingId: string, imageId: string): Promise<any> => {
    const { data } = await axiosClient.patch(`/api/v2/bookings/${bookingId}/images/${imageId}/primary`);
    return data;
  },

  // ─── Upsells ────────────────────────────────────────────────────────────────
  // Extra line items added to a booking after creation. Commission is recognised
  // in the month the upsell was added (`added_at`), so they have their own
  // endpoints (keeping `added_at` immutable) rather than re-stamping on a booking
  // PATCH. Backend lands in Phase 3.
  listUpsells: async (bookingId: string): Promise<UpsellRecord[]> => {
    const { data } = await axiosClient.get<UpsellRecord[]>(`/api/v2/bookings/${bookingId}/upsells`);
    return data;
  },

  createUpsell: async (bookingId: string, body: UpsellPayload): Promise<UpsellRecord> => {
    const { data } = await axiosClient.post<UpsellRecord>(`/api/v2/bookings/${bookingId}/upsells`, body);
    return data;
  },

  updateUpsell: async (upsellId: string, body: Partial<UpsellPayload>): Promise<UpsellRecord> => {
    const { data } = await axiosClient.patch<UpsellRecord>(`/api/v2/upsells/${upsellId}`, body);
    return data;
  },

  removeUpsell: async (upsellId: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/upsells/${upsellId}`);
  },
};

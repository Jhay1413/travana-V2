import axiosClient from "../client/axios-client";
import type { EnquiryTable } from "@/types/quote";

export const enquiryApi = {
  getAll: async (): Promise<EnquiryTable[]> => {
    const { data } = await axiosClient.get<EnquiryTable[]>("/api/enquiries");
    return data;
  },

  getById: async (id: string): Promise<EnquiryTable> => {
    const { data } = await axiosClient.get<EnquiryTable>(`/api/enquiries/${id}`);
    return data;
  },

  getByTransactionId: async (transactionId: string): Promise<EnquiryTable> => {
    const { data } = await axiosClient.get<EnquiryTable>(`/api/enquiries/transaction/${transactionId}`);
    return data;
  },

  create: async (enquiryData: Partial<EnquiryTable>): Promise<EnquiryTable> => {
    const { data } = await axiosClient.post<EnquiryTable>("/api/enquiries", enquiryData);
    return data;
  },

  update: async (id: string, enquiryData: Partial<EnquiryTable> & { destinations?: string[]; resorts?: string[]; boardBases?: string[]; departureAirports?: string[]; passengers?: any[] }): Promise<EnquiryTable> => {
    const { data } = await axiosClient.patch<EnquiryTable>(`/api/enquiries/${id}`, enquiryData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/enquiries/${id}`);
  },
};

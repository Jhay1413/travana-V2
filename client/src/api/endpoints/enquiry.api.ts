import axiosClient from "../client/axios-client";
import type { Enquiry, CreateEnquiryData, EnquiryFilters } from "@/types/enquiry";

export const enquiryApi = {
  getAll: async (filters?: EnquiryFilters): Promise<Enquiry[]> => {
    const params = new URLSearchParams();
    if (filters?.clientId) params.append("clientId", filters.clientId);
    const query = params.toString();
    const { data } = await axiosClient.get<Enquiry[]>(`/api/enquiries${query ? `?${query}` : ""}`);
    return data;
  },

  getById: async (id: string): Promise<Enquiry> => {
    const { data } = await axiosClient.get<Enquiry>(`/api/enquiries/${id}`);
    return data;
  },

  create: async (enquiryData: CreateEnquiryData): Promise<Enquiry> => {
    const { data } = await axiosClient.post<Enquiry>("/api/enquiries", enquiryData);
    return data;
  },

  update: async (id: string, enquiryData: Partial<CreateEnquiryData>): Promise<Enquiry> => {
    const { data } = await axiosClient.patch<Enquiry>(`/api/enquiries/${id}`, enquiryData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/enquiries/${id}`);
  },
};

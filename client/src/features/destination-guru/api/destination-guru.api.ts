import axiosClient from "@/api/client/axios-client";
import type { DestinationGuruData } from "@/features/destination-guru/components/destination-guru";

export type DestinationGuruRecord = {
  id: string;
  destination: string;
  country: string;
  data: DestinationGuruData;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export const destinationGuruApi = {
  getAll: async (): Promise<DestinationGuruRecord[]> => {
    const { data } = await axiosClient.get("/api/v2/destination-guru");
    return data;
  },

  getById: async (id: string): Promise<DestinationGuruRecord> => {
    const { data } = await axiosClient.get(`/api/v2/destination-guru/${id}`);
    return data;
  },

  searchByDestination: async (destination: string): Promise<DestinationGuruRecord> => {
    const { data } = await axiosClient.get(`/api/v2/destination-guru/search/${encodeURIComponent(destination)}`);
    return data;
  },

  generate: async (destination: string): Promise<DestinationGuruRecord> => {
    const { data } = await axiosClient.post("/api/v2/destination-guru/generate", { destination });
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/destination-guru/${id}`);
  },
};

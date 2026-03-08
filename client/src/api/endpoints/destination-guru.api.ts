import axiosClient from "../client/axios-client";
import type { DestinationGuruData } from "@/components/destination-guru";

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
    const { data } = await axiosClient.get("/api/destination-guru");
    return data;
  },

  getById: async (id: string): Promise<DestinationGuruRecord> => {
    const { data } = await axiosClient.get(`/api/destination-guru/${id}`);
    return data;
  },

  searchByDestination: async (destination: string): Promise<DestinationGuruRecord> => {
    const { data } = await axiosClient.get(`/api/destination-guru/search/${encodeURIComponent(destination)}`);
    return data;
  },

  generate: async (destination: string): Promise<DestinationGuruRecord> => {
    const { data } = await axiosClient.post("/api/destination-guru/generate", { destination });
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/destination-guru/${id}`);
  },
};

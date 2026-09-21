import axiosClient from "@/api/client/axios-client";
import type { DestinationGuruData } from "@/features/destination-guru/components/destination-guru";

export type DestinationGuruRecord = {
  id: string;
  destination: string;
  country: string;
  data: DestinationGuruData;
  createdBy: string | null;
  latitude: number | null;
  longitude: number | null;
  // 'failed' = geocoding was attempted (generation-time or backfill) but
  // didn't resolve — lat/lng stay null, same as any other un-pinned row.
  coordinatesSource: "ai" | "backfill" | "manual" | "failed" | null;
  createdAt: string;
  updatedAt: string;
};

export type UpdateDestinationGuruCoordinatesInput = {
  latitude: number;
  longitude: number;
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

  updateCoordinates: async (
    id: string,
    body: UpdateDestinationGuruCoordinatesInput,
  ): Promise<DestinationGuruRecord> => {
    const { data } = await axiosClient.patch(`/api/v2/destination-guru/${id}/coordinates`, body);
    return data;
  },
};

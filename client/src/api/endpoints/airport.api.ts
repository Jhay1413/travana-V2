import axiosClient from "../client/axios-client";
import type { Airport } from "@/types/airport";

export const airportApi = {
  getAll: async (): Promise<Airport[]> => {
    const { data } = await axiosClient.get<Airport[]>("/api/v2/airports");
    return data;
  },

  create: async (airportData: Omit<Airport, "id" | "createdAt">): Promise<Airport> => {
    const { data } = await axiosClient.post<Airport>("/api/v2/airports", airportData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/airports/${id}`);
  },
};

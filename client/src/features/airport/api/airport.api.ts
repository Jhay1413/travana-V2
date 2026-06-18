import axiosClient from "@/api/client/axios-client";
import type { Airport } from "../types";

export const airportApi = {
  getAll: async (countryIds?: string[]): Promise<Airport[]> => {
    const params: Record<string, string> = {};
    if (countryIds?.length) params.countryIds = countryIds.join(",");
    const { data } = await axiosClient.get<Airport[]>("/api/v2/airports", { params });
    return data;
  },

  create: async (airportData: { airport_name: string; airport_code: string; country_id?: string }): Promise<Airport> => {
    const { data } = await axiosClient.post<Airport>("/api/v2/airports", airportData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/airports/${id}`);
  },
};

import axiosClient from "@/api/client/axios-client";
import type { TourOperator } from "../types";

export const tourOperatorApi = {
  getAll: async (): Promise<TourOperator[]> => {
    const { data } = await axiosClient.get<TourOperator[]>("/api/v2/tour-operators");
    return data;
  },

  create: async (operatorData: Omit<TourOperator, "id" | "createdAt" | "updatedAt">): Promise<TourOperator> => {
    const { data } = await axiosClient.post<TourOperator>("/api/v2/tour-operators", operatorData);
    return data;
  },

  update: async (id: string, operatorData: Partial<TourOperator>): Promise<TourOperator> => {
    const { data } = await axiosClient.patch<TourOperator>(`/api/v2/tour-operators/${id}`, operatorData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/tour-operators/${id}`);
  },
};

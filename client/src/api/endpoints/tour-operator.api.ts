import axiosClient from "../client/axios-client";
import type { TourOperator } from "@/types/tour-operator";

export const tourOperatorApi = {
  getAll: async (): Promise<TourOperator[]> => {
    const { data } = await axiosClient.get<TourOperator[]>("/api/tour-operators");
    return data;
  },

  create: async (operatorData: Omit<TourOperator, "id" | "createdAt" | "updatedAt">): Promise<TourOperator> => {
    const { data } = await axiosClient.post<TourOperator>("/api/tour-operators", operatorData);
    return data;
  },

  update: async (id: string, operatorData: Partial<TourOperator>): Promise<TourOperator> => {
    const { data } = await axiosClient.patch<TourOperator>(`/api/tour-operators/${id}`, operatorData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/tour-operators/${id}`);
  },
};

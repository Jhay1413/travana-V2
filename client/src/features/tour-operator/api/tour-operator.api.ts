import axiosClient from "@/api/client/axios-client";
import { TOUR_OPERATOR_ENDPOINTS } from "@/api/endpoints";
import type { TourOperator } from "../types";

export const tourOperatorApi = {
  getAll: async (): Promise<TourOperator[]> => {
    const { data } = await axiosClient.get<TourOperator[]>(TOUR_OPERATOR_ENDPOINTS.list, {
      params: { includeInactive: 1 },
    });
    return data;
  },
};

import axiosClient from "@/api/client/axios-client";
import { TARGETS_ENDPOINTS } from "@/api/endpoints";
import type { AllocationInput, MonthsInput, OverrideInput, TargetsYear } from "../types";

/** The response interceptor unwraps the `{ data }` envelope, so these return the payload directly. */
export const targetsYearApi = {
  getYear: async (year: number): Promise<TargetsYear> => {
    const { data } = await axiosClient.get<TargetsYear>(TARGETS_ENDPOINTS.year, { params: { year } });
    return data;
  },

  saveBusiness: async (input: MonthsInput): Promise<unknown> => {
    const { data } = await axiosClient.put<unknown>(TARGETS_ENDPOINTS.business, input);
    return data;
  },

  saveMine: async (input: MonthsInput): Promise<unknown> => {
    const { data } = await axiosClient.put<unknown>(TARGETS_ENDPOINTS.mine, input);
    return data;
  },

  saveOverride: async (userId: string, input: OverrideInput): Promise<unknown> => {
    const { data } = await axiosClient.put<unknown>(TARGETS_ENDPOINTS.homeworkerOverride(userId), input);
    return data;
  },

  revertOverride: async (userId: string, year: number): Promise<unknown> => {
    const { data } = await axiosClient.delete<unknown>(TARGETS_ENDPOINTS.homeworkerOverride(userId), { params: { year } });
    return data;
  },

  saveAllocation: async (input: AllocationInput): Promise<TargetsYear> => {
    const { data } = await axiosClient.post<TargetsYear>(TARGETS_ENDPOINTS.allocation, input);
    return data;
  },
};

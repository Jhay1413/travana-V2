import axiosClient from "@/api/client/axios-client";
import { DEPARTURES_ENDPOINTS } from "@/api/endpoints";
import type { DepartureCheckKey, DepartureListParams, DepartureRow, DepartureSummary } from "../types";

// The axios response interceptor already unwraps the `{ success, data }` envelope,
// so `response.data` IS the payload here.
export const departuresApi = {
  list: async (params: DepartureListParams): Promise<DepartureRow[]> => {
    const { data } = await axiosClient.get<{ rows: DepartureRow[] }>(DEPARTURES_ENDPOINTS.list, {
      params: { ...(params.from ? { from: params.from } : {}), ...(params.to ? { to: params.to } : {}) },
    });
    return data.rows;
  },
  summary: async (days: number): Promise<DepartureSummary> => {
    const { data } = await axiosClient.get<DepartureSummary>(DEPARTURES_ENDPOINTS.summary, { params: { days } });
    return data;
  },
  setCheck: async (bookingId: string, key: DepartureCheckKey, value: boolean): Promise<DepartureRow> => {
    const { data } = await axiosClient.patch<DepartureRow>(DEPARTURES_ENDPOINTS.checks(bookingId), { key, value });
    return data;
  },
};

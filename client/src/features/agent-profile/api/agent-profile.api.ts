import axiosClient from "@/api/client/axios-client";
import { AGENT_PROFILE_ENDPOINTS } from "@/api/endpoints";
import type {
  AgentProfileDeal,
  AgentProfileHeader,
  AgentProfileMonthly,
  AgentProfilePayouts,
  AgentProfilePerformance,
  AgentProfileTraining,
  AgentProfileWeek,
} from "../types";

/** The response interceptor unwraps the `{ data }` envelope, so these return the payload directly. */
export const agentProfileApi = {
  getHeader: async (userId: string): Promise<AgentProfileHeader> => {
    const { data } = await axiosClient.get<AgentProfileHeader>(AGENT_PROFILE_ENDPOINTS.header(userId));
    return data;
  },
  getPerformance: async (userId: string, from: string, to: string): Promise<AgentProfilePerformance> => {
    const { data } = await axiosClient.get<AgentProfilePerformance>(AGENT_PROFILE_ENDPOINTS.performance(userId), {
      params: { from, to },
    });
    return data;
  },
  getWeek: async (userId: string, start: string): Promise<AgentProfileWeek> => {
    const { data } = await axiosClient.get<AgentProfileWeek>(AGENT_PROFILE_ENDPOINTS.week(userId), { params: { start } });
    return data;
  },
  getMonthly: async (userId: string, year: number): Promise<AgentProfileMonthly> => {
    const { data } = await axiosClient.get<AgentProfileMonthly>(AGENT_PROFILE_ENDPOINTS.monthly(userId), { params: { year } });
    return data;
  },
  getBiggestDeals: async (userId: string, limit: number): Promise<AgentProfileDeal[]> => {
    const { data } = await axiosClient.get<{ rows: AgentProfileDeal[] }>(AGENT_PROFILE_ENDPOINTS.biggestDeals(userId), {
      params: { limit },
    });
    return data.rows;
  },
  getTraining: async (userId: string): Promise<AgentProfileTraining> => {
    const { data } = await axiosClient.get<AgentProfileTraining>(AGENT_PROFILE_ENDPOINTS.training(userId));
    return data;
  },
  getPayouts: async (userId: string): Promise<AgentProfilePayouts> => {
    const { data } = await axiosClient.get<AgentProfilePayouts>(AGENT_PROFILE_ENDPOINTS.payouts(userId));
    return data;
  },
};

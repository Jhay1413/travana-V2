import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type {
  AgentProfileDeal,
  AgentProfileHeader,
  AgentProfileMonthly,
  AgentProfilePayouts,
  AgentProfilePerformance,
  AgentProfileTraining,
  AgentProfileWeek,
} from "../types";
import { agentProfileApi } from "./agent-profile.api";

export const agentProfileKeys = {
  all: ["agent-profile"] as const,
  header: (userId: string) => ["agent-profile", userId, "header"] as const,
  performance: (userId: string, from: string, to: string) => ["agent-profile", userId, "performance", from, to] as const,
  week: (userId: string, start: string) => ["agent-profile", userId, "week", start] as const,
  monthly: (userId: string, year: number) => ["agent-profile", userId, "monthly", year] as const,
  biggestDeals: (userId: string, limit: number) => ["agent-profile", userId, "biggest-deals", limit] as const,
  training: (userId: string) => ["agent-profile", userId, "training"] as const,
  payouts: (userId: string) => ["agent-profile", userId, "payouts"] as const,
};

const STALE = 30 * 1000;

export function useAgentProfileHeader(userId: string) {
  return useQuery<AgentProfileHeader>({
    queryKey: agentProfileKeys.header(userId),
    queryFn: () => agentProfileApi.getHeader(userId),
    enabled: !!userId,
    retry: false,
    staleTime: STALE,
  });
}

export function useAgentProfilePerformance(userId: string, from: string, to: string) {
  return useQuery<AgentProfilePerformance>({
    queryKey: agentProfileKeys.performance(userId, from, to),
    queryFn: () => agentProfileApi.getPerformance(userId, from, to),
    enabled: !!userId,
    retry: false,
    staleTime: STALE,
    placeholderData: keepPreviousData,
  });
}

export function useAgentProfileWeek(userId: string, start: string) {
  return useQuery<AgentProfileWeek>({
    queryKey: agentProfileKeys.week(userId, start),
    queryFn: () => agentProfileApi.getWeek(userId, start),
    enabled: !!userId,
    retry: false,
    staleTime: STALE,
  });
}

export function useAgentProfileMonthly(userId: string, year: number) {
  return useQuery<AgentProfileMonthly>({
    queryKey: agentProfileKeys.monthly(userId, year),
    queryFn: () => agentProfileApi.getMonthly(userId, year),
    enabled: !!userId,
    retry: false,
    staleTime: STALE,
    placeholderData: keepPreviousData,
  });
}

export function useAgentProfileBiggestDeals(userId: string, limit = 5) {
  return useQuery<AgentProfileDeal[]>({
    queryKey: agentProfileKeys.biggestDeals(userId, limit),
    queryFn: () => agentProfileApi.getBiggestDeals(userId, limit),
    enabled: !!userId,
    retry: false,
    staleTime: STALE,
  });
}

export function useAgentProfileTraining(userId: string) {
  return useQuery<AgentProfileTraining>({
    queryKey: agentProfileKeys.training(userId),
    queryFn: () => agentProfileApi.getTraining(userId),
    enabled: !!userId,
    retry: false,
    staleTime: STALE,
  });
}

export function useAgentProfilePayouts(userId: string, enabled: boolean) {
  return useQuery<AgentProfilePayouts>({
    queryKey: agentProfileKeys.payouts(userId),
    queryFn: () => agentProfileApi.getPayouts(userId),
    enabled: !!userId && enabled,
    retry: false,
    staleTime: STALE,
  });
}

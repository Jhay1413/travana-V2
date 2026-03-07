import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { targetsApi } from "../../api";
import type { BulkShopTargetsInput, BulkAgentTargetsInput } from "../../types/targets/targets.types";

const TARGETS_QUERY_KEYS = {
  overview: ["targets", "overview"] as const,
  shopTargets: ["targets", "shop"] as const,
  agentTargets: ["targets", "agent"] as const,
  agentTargetsByUser: (userId: string) => ["targets", "agent", userId] as const,
  agents: ["targets", "agents"] as const,
};

// ─── Overview ───────────────────────────────────────────────────────────

export function useTargetsOverview() {
  return useQuery({
    queryKey: TARGETS_QUERY_KEYS.overview,
    queryFn: () => targetsApi.getOverview(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ─── Shop Targets ───────────────────────────────────────────────────────────

export function useShopTargets() {
  return useQuery({
    queryKey: TARGETS_QUERY_KEYS.shopTargets,
    queryFn: () => targetsApi.getShopTargets(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertShopTargets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BulkShopTargetsInput) => targetsApi.upsertShopTargets(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TARGETS_QUERY_KEYS.shopTargets });
      queryClient.invalidateQueries({ queryKey: TARGETS_QUERY_KEYS.overview });
    },
  });
}

// ─── Agent Targets ───────────────────────────────────────────────────────────

export function useAgentTargets() {
  return useQuery({
    queryKey: TARGETS_QUERY_KEYS.agentTargets,
    queryFn: () => targetsApi.getAgentTargets(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAgentTargetsByUserId(userId: string) {
  return useQuery({
    queryKey: TARGETS_QUERY_KEYS.agentTargetsByUser(userId),
    queryFn: () => targetsApi.getAgentTargetsByUserId(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertAgentTargets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BulkAgentTargetsInput) => targetsApi.upsertAgentTargets(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TARGETS_QUERY_KEYS.agentTargets });
      queryClient.invalidateQueries({ queryKey: TARGETS_QUERY_KEYS.overview });
    },
  });
}

// ─── Agents ───────────────────────────────────────────────────────────

export function useAgents() {
  return useQuery({
    queryKey: TARGETS_QUERY_KEYS.agents,
    queryFn: () => targetsApi.getAgents(),
    staleTime: 10 * 60 * 1000, // 10 minutes (agents don't change often)
  });
}

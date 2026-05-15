import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { targetsApi } from "../../api";
import type { BulkShopTargetsInput, BulkAgentTargetsInput } from "../../types/targets/targets.types";

const TARGETS_QUERY_KEYS = {
  overview: (branchId?: string) => ["targets", "overview", branchId ?? null] as const,
  shopTargets: (branchId?: string) => ["targets", "shop", branchId ?? null] as const,
  agentTargets: (branchId?: string) => ["targets", "agent", branchId ?? null] as const,
  agentTargetsByUser: (userId: string, branchId?: string) =>
    ["targets", "agent", userId, branchId ?? null] as const,
  agents: (branchId?: string) => ["targets", "agents", branchId ?? null] as const,
};

// ─── Overview ───────────────────────────────────────────────────────────

export function useTargetsOverview(branchId?: string) {
  return useQuery({
    queryKey: TARGETS_QUERY_KEYS.overview(branchId),
    queryFn: () => targetsApi.getOverview(branchId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ─── Shop Targets ───────────────────────────────────────────────────────────

export function useShopTargets(branchId?: string) {
  return useQuery({
    queryKey: TARGETS_QUERY_KEYS.shopTargets(branchId),
    queryFn: () => targetsApi.getShopTargets(branchId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertShopTargets(branchId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BulkShopTargetsInput) => targetsApi.upsertShopTargets(input, branchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TARGETS_QUERY_KEYS.shopTargets(branchId) });
      queryClient.invalidateQueries({ queryKey: TARGETS_QUERY_KEYS.overview(branchId) });
    },
  });
}

// ─── Agent Targets ───────────────────────────────────────────────────────────

export function useAgentTargets(branchId?: string) {
  return useQuery({
    queryKey: TARGETS_QUERY_KEYS.agentTargets(branchId),
    queryFn: () => targetsApi.getAgentTargets(branchId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAgentTargetsByUserId(userId: string, branchId?: string) {
  return useQuery({
    queryKey: TARGETS_QUERY_KEYS.agentTargetsByUser(userId, branchId),
    queryFn: () => targetsApi.getAgentTargetsByUserId(userId, branchId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertAgentTargets(branchId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BulkAgentTargetsInput) => targetsApi.upsertAgentTargets(input, branchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TARGETS_QUERY_KEYS.agentTargets(branchId) });
      queryClient.invalidateQueries({ queryKey: TARGETS_QUERY_KEYS.overview(branchId) });
    },
  });
}

// ─── Agents ───────────────────────────────────────────────────────────

export function useAgents(branchId?: string) {
  return useQuery({
    queryKey: TARGETS_QUERY_KEYS.agents(branchId),
    queryFn: () => targetsApi.getAgents(branchId),
    staleTime: 10 * 60 * 1000, // 10 minutes (agents don't change often)
  });
}

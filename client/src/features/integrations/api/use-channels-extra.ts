import { useMutation, useQuery } from "@tanstack/react-query";
import { channelsKeys } from "@/features/conversations";
import { channelsExtraApi } from "./channels-extra.api";
import type { DelegateConnectInput } from "../types";

export const integrationsKeys = {
  status: () => [...channelsKeys.all, "status"] as const,
  health: () => [...channelsKeys.all, "health"] as const,
};

export function useChannelWorkspaceStatus() {
  return useQuery({
    queryKey: integrationsKeys.status(),
    queryFn: () => channelsExtraApi.status(),
    staleTime: 60_000,
  });
}

export function useChannelHealth(enabled = true) {
  return useQuery({
    queryKey: integrationsKeys.health(),
    queryFn: () => channelsExtraApi.health(),
    enabled,
    staleTime: 30_000,
  });
}

export function useDelegateConnect() {
  return useMutation({
    mutationFn: (input: DelegateConnectInput) => channelsExtraApi.delegate(input),
  });
}

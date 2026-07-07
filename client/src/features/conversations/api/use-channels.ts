import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { channelsApi, type ConnectTokenInput } from "./channels.api";

export const channelsKeys = {
  all: ["channels"] as const,
  list: () => [...channelsKeys.all, "list"] as const,
  types: () => [...channelsKeys.all, "types"] as const,
};

export function useChannels(enabled = true) {
  return useQuery({
    queryKey: channelsKeys.list(),
    queryFn: () => channelsApi.list(),
    enabled,
    staleTime: 30_000,
  });
}

export function useChannelTypes(enabled = true) {
  return useQuery({
    queryKey: channelsKeys.types(),
    queryFn: () => channelsApi.types(),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useCreateConnectToken() {
  return useMutation({
    mutationFn: (input: ConnectTokenInput) => channelsApi.createConnectToken(input),
  });
}

export function useDeleteChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channelId: string) => channelsApi.remove(channelId),
    onSuccess: () => qc.invalidateQueries({ queryKey: channelsKeys.list() }),
  });
}

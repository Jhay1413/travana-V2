import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { botConfigApi } from "./bot-config.api";
import type { BotConfigUpdatePayload, BotMode } from "../types";

export const botConfigKeys = {
  all: ["bot-config"] as const,
  detail: () => [...botConfigKeys.all, "detail"] as const,
};

export function useBotConfig() {
  return useQuery({
    queryKey: botConfigKeys.detail(),
    queryFn: botConfigApi.get,
  });
}

export function useUpdateBotConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BotConfigUpdatePayload) => botConfigApi.update(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: botConfigKeys.detail() });
    },
  });
}

export function useEnableBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mode?: BotMode) => botConfigApi.enable(mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: botConfigKeys.detail() });
    },
  });
}

export function useDisableBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => botConfigApi.disable(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: botConfigKeys.detail() });
    },
  });
}

export function useConnectWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => botConfigApi.connectWebhook(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: botConfigKeys.detail() });
    },
  });
}

export function useDisconnectWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => botConfigApi.disconnectWebhook(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: botConfigKeys.detail() });
    },
  });
}

export function useSetBotMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mode: BotMode) => botConfigApi.setMode(mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: botConfigKeys.detail() });
    },
  });
}

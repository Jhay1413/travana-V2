import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerMessagingApi } from "./customer-messaging.api";
import type { AutoChannel, AutoMessagePurpose, TemplateSettings } from "../types";

export const customerMessagingKeys = {
  all: ["customer-messaging"] as const,
  settings: () => [...customerMessagingKeys.all, "settings"] as const,
  readiness: () => [...customerMessagingKeys.all, "readiness"] as const,
  template: (purpose: AutoMessagePurpose) => [...customerMessagingKeys.all, "template", purpose] as const,
};

export function useAutoChannel(enabled = true) {
  return useQuery({ queryKey: customerMessagingKeys.settings(), queryFn: () => customerMessagingApi.getSettings(), enabled, staleTime: 30_000 });
}

export function useSaveAutoChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (autoChannel: AutoChannel) => customerMessagingApi.saveSettings(autoChannel),
    // The status lines depend on the channel, so they are fetched again.
    onSuccess: () => qc.invalidateQueries({ queryKey: customerMessagingKeys.all }),
  });
}

export function useCustomerMessagingReadiness(enabled = true) {
  return useQuery({ queryKey: customerMessagingKeys.readiness(), queryFn: () => customerMessagingApi.getReadiness(), enabled, staleTime: 15_000 });
}

export function usePurposeTemplate(purpose: AutoMessagePurpose, enabled = true) {
  return useQuery({ queryKey: customerMessagingKeys.template(purpose), queryFn: () => customerMessagingApi.getTemplate(purpose), enabled, staleTime: 30_000 });
}

export function useSavePurposeTemplate(purpose: AutoMessagePurpose) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TemplateSettings) => customerMessagingApi.saveTemplate(purpose, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: customerMessagingKeys.template(purpose) });
      void qc.invalidateQueries({ queryKey: customerMessagingKeys.readiness() });
    },
  });
}

export function useSetMessageSwitch(purpose: AutoMessagePurpose) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (active: boolean) => customerMessagingApi.setSwitch(purpose, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: customerMessagingKeys.readiness() }),
  });
}

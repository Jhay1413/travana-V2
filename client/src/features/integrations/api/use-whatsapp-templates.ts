import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { channelsKeys, conversationsKeys } from "@/features/conversations";
import { whatsappTemplatesApi } from "./whatsapp-templates.api";
import type { CreateWaTemplateInput, QuoteTemplateSettings, UpdateTemplateSettings } from "../types";

export const templatesKeys = {
  all: [...channelsKeys.all, "whatsapp-templates"] as const,
  list: (channelId: string) => [...channelsKeys.all, "whatsapp-templates", "list", channelId] as const,
  settings: () => [...channelsKeys.all, "whatsapp-templates", "quote-settings"] as const,
  updateSettings: () => [...channelsKeys.all, "whatsapp-templates", "update-settings"] as const,
};

export function useWhatsappTemplates(channelId: string | null) {
  return useQuery({
    queryKey: templatesKeys.list(channelId ?? ""),
    queryFn: () => whatsappTemplatesApi.list(channelId as string),
    enabled: !!channelId,
    staleTime: 30_000,
  });
}

export function useSyncTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channelId: string) => whatsappTemplatesApi.sync(channelId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...templatesKeys.all, "list"] }),
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWaTemplateInput) => whatsappTemplatesApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...templatesKeys.all, "list"] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => whatsappTemplatesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...templatesKeys.all, "list"] }),
  });
}

export function useQuoteTemplateSettings(enabled = true) {
  return useQuery({
    queryKey: templatesKeys.settings(),
    queryFn: () => whatsappTemplatesApi.getSettings(),
    enabled,
    staleTime: 30_000,
  });
}

export function useSaveQuoteTemplateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: QuoteTemplateSettings) => whatsappTemplatesApi.saveSettings(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: templatesKeys.settings() }),
  });
}

export function useUpdateTemplateSettings(enabled = true) {
  return useQuery({
    queryKey: templatesKeys.updateSettings(),
    queryFn: () => whatsappTemplatesApi.getUpdateSettings(),
    enabled,
    staleTime: 30_000,
  });
}

export function useSaveUpdateTemplateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTemplateSettings) => whatsappTemplatesApi.saveUpdateSettings(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: templatesKeys.updateSettings() });
      // The inbox composer reads whether an update template exists.
      void qc.invalidateQueries({ queryKey: conversationsKeys.updateTemplate() });
    },
  });
}

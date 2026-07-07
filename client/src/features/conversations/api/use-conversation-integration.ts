import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { conversationIntegrationApi, type SetIntegrationInput } from "./conversation-integration.api";

export const integrationKeys = {
  all: ["conversation-integration"] as const,
  status: (orgId: string) => [...integrationKeys.all, "status", orgId] as const,
};

export function useConversationIntegration(orgId: string | undefined) {
  return useQuery({
    queryKey: integrationKeys.status(orgId ?? ""),
    queryFn: () => conversationIntegrationApi.getStatus(orgId as string),
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

function useAfterChange(orgId: string | undefined) {
  const qc = useQueryClient();
  return () => {
    if (orgId) qc.invalidateQueries({ queryKey: integrationKeys.status(orgId) });
  };
}

export function useSetConversationIntegration(orgId: string | undefined) {
  const afterChange = useAfterChange(orgId);
  return useMutation({
    mutationFn: (input: SetIntegrationInput) => conversationIntegrationApi.setToken(orgId as string, input),
    onSuccess: afterChange,
  });
}

export function useRemoveConversationIntegration(orgId: string | undefined) {
  const afterChange = useAfterChange(orgId);
  return useMutation({
    mutationFn: () => conversationIntegrationApi.remove(orgId as string),
    onSuccess: afterChange,
  });
}

export function useTestConversationIntegration(orgId: string | undefined) {
  return useMutation({
    mutationFn: () => conversationIntegrationApi.test(orgId as string),
  });
}

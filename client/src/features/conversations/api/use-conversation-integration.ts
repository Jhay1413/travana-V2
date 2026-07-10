import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { conversationIntegrationApi, type SetIntegrationInput } from "./conversation-integration.api";

export const integrationKeys = {
  all: ["conversation-integration"] as const,
  status: (orgId: string) => [...integrationKeys.all, "status", orgId] as const,
  statuses: () => [...integrationKeys.all, "statuses"] as const,
};

// All-org integration summary (platform-admin org list).
export function useIntegrationStatuses(enabled = true) {
  return useQuery({
    queryKey: integrationKeys.statuses(),
    queryFn: () => conversationIntegrationApi.listStatuses(),
    enabled,
    staleTime: 60_000,
  });
}

export function useConversationIntegration(orgId: string | undefined) {
  return useQuery({
    queryKey: integrationKeys.status(orgId ?? ""),
    queryFn: () => conversationIntegrationApi.getStatus(orgId as string),
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

function useAfterChange(_orgId: string | undefined) {
  const qc = useQueryClient();
  return () => {
    // Refresh both the per-org status and the all-org list (needs-key badge).
    qc.invalidateQueries({ queryKey: integrationKeys.all });
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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { neonClientApi } from "@/api";
import { neonClientKeys } from "@/hooks/queries";
import type { NeonClient, NeonClientImportRow } from "@/features/client/types/neon-client";

export function useCreateNeonClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<NeonClient>) => neonClientApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: neonClientKeys.lists() });
    },
  });
}

export function useUpdateNeonClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<NeonClient> }) =>
      neonClientApi.updateClient(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: neonClientKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: neonClientKeys.all });
    },
  });
}

export function useImportNeonClients() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clients: NeonClientImportRow[]) => neonClientApi.importClients(clients),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: neonClientKeys.lists() });
    },
  });
}

export function useMergeNeonClients() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
      neonClientApi.merge(sourceId, targetId),
    // A merge reassigns deals/files/notes/tickets across clients, so refetch
    // everything rather than trying to enumerate every affected query key.
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

/** Fold a whole duplicate-phone group into the chosen main client in one request. */
export function useMergeDuplicateClients() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ targetId, sourceIds }: { targetId: string; sourceIds: string[] }) =>
      neonClientApi.mergeDuplicates(targetId, sourceIds),
    // Same reasoning as useMergeNeonClients: too many query keys are affected
    // to enumerate, and the duplicate list itself must shrink.
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

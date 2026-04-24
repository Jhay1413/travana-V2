import { useMutation, useQueryClient } from "@tanstack/react-query";
import { neonClientApi } from "@/api";
import { neonClientKeys } from "@/hooks/queries";
import type { NeonClient, NeonClientImportRow } from "@/types/neon-client";

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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { neonClientApi } from "@/api";
import { neonClientKeys } from "@/hooks/queries";
import type { NeonClientImportRow } from "@/types/neon-client";

export function useImportNeonClients() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clients: NeonClientImportRow[]) => neonClientApi.importClients(clients),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: neonClientKeys.lists() });
    },
  });
}

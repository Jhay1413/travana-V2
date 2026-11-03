import { useQuery } from "@tanstack/react-query";
import { clientApi } from "@/api";
import type { Client } from "@/features/client/types";

export const clientKeys = {
  all: ["clients"] as const,
  lists: () => [...clientKeys.all, "list"] as const,
  list: () => [...clientKeys.lists()] as const,
  details: () => [...clientKeys.all, "detail"] as const,
  detail: (id: string) => [...clientKeys.details(), id] as const,
};

export function useClients(options: { enabled?: boolean } = {}) {
  return useQuery<Client[]>({
    queryKey: clientKeys.list(),
    queryFn: clientApi.getAll,
    enabled: options.enabled ?? true,
  });
}

export function useClient(id: string) {
  return useQuery<Client>({
    queryKey: clientKeys.detail(id),
    queryFn: () => clientApi.getById(id),
    enabled: !!id,
  });
}

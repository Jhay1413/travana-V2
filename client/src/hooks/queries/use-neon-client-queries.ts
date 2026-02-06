import { useQuery } from "@tanstack/react-query";
import { neonClientApi } from "@/api";

export const neonClientKeys = {
  all: ["neon-clients"] as const,
  lists: () => [...neonClientKeys.all, "list"] as const,
  detail: (id: string) => [...neonClientKeys.all, "detail", id] as const,
};

export function useNeonClients() {
  return useQuery({
    queryKey: neonClientKeys.lists(),
    queryFn: neonClientApi.getAll,
  });
}

export function useNeonClient(id: string) {
  return useQuery({
    queryKey: neonClientKeys.detail(id),
    queryFn: () => neonClientApi.getById(id),
    enabled: !!id,
  });
}

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { neonClientApi } from "@/api";

export const neonClientKeys = {
  all: ["neon-clients"] as const,
  lists: () => [...neonClientKeys.all, "list"] as const,
  paginated: (page: number, limit: number, search?: string) => [...neonClientKeys.all, "list", { page, limit, search }] as const,
  detail: (id: string) => [...neonClientKeys.all, "detail", id] as const,
};

export function useNeonClients(params?: { page?: number; limit?: number; search?: string }) {
  return useQuery({
    queryKey: neonClientKeys.paginated(params?.page ?? 1, params?.limit ?? 10, params?.search),
    queryFn: () => neonClientApi.getAll(params),
    placeholderData: keepPreviousData,
  });
}

export function useNeonClient(id: string) {
  return useQuery({
    queryKey: neonClientKeys.detail(id),
    queryFn: () => neonClientApi.getById(id),
    enabled: !!id,
  });
}

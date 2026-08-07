import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { neonClientApi } from "@/api";

export const neonClientKeys = {
  all: ["neon-clients"] as const,
  lists: () => [...neonClientKeys.all, "list"] as const,
  paginated: (page: number, limit: number, search?: string) => [...neonClientKeys.all, "list", { page, limit, search }] as const,
  detail: (id: string) => [...neonClientKeys.all, "detail", id] as const,
  duplicates: () => [...neonClientKeys.all, "duplicates", "phone"] as const,
  duplicatesPaginated: (page: number, limit: number, search?: string) =>
    [...neonClientKeys.duplicates(), { page, limit, search }] as const,
  duplicateGroup: (phoneKey: string) => [...neonClientKeys.duplicates(), "group", phoneKey] as const,
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

export function useDuplicatePhoneGroups(params?: { page?: number; limit?: number; search?: string }) {
  return useQuery({
    queryKey: neonClientKeys.duplicatesPaginated(params?.page ?? 1, params?.limit ?? 20, params?.search),
    queryFn: () => neonClientApi.getDuplicatePhoneGroups(params),
    placeholderData: keepPreviousData,
  });
}

/** The clients behind one duplicate phone number. Pass null to keep it idle. */
export function useDuplicatePhoneGroup(phoneKey: string | null) {
  return useQuery({
    queryKey: neonClientKeys.duplicateGroup(phoneKey ?? ""),
    queryFn: () => neonClientApi.getDuplicatePhoneGroup(phoneKey as string),
    enabled: !!phoneKey,
  });
}

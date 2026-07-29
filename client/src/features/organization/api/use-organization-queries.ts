import { useQuery } from "@tanstack/react-query";
import { organizationApi, type Organization, type OrgMember } from "./organization.api";

export const organizationKeys = {
  all: ["organization"] as const,
  current: () => [...organizationKeys.all, "current"] as const,
  members: () => [...organizationKeys.all, "members"] as const,
};

export function useCurrentOrganization() {
  return useQuery<Organization>({
    queryKey: organizationKeys.current(),
    queryFn: organizationApi.getMine,
    staleTime: 60_000,
    // The sidenav mounts this observer for the whole session and never remounts,
    // so with the global `retry: false` / `refetchOnWindowFocus: false` defaults a
    // single failed fetch (it races the session bootstrap on first paint) left the
    // org — and therefore the brand logo — permanently missing. It only reappeared
    // once an Agency page mounted a fresh observer and triggered a refetch. Let
    // this query recover on its own instead.
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useOrgMembers(options?: { enabled?: boolean }) {
  return useQuery<OrgMember[]>({
    queryKey: organizationKeys.members(),
    queryFn: organizationApi.listMembers,
    enabled: options?.enabled ?? true,
  });
}

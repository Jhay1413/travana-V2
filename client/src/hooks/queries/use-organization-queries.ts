import { useQuery } from "@tanstack/react-query";
import { organizationApi, type Organization, type OrgMember } from "@/api/endpoints/organization.api";

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
  });
}

export function useOrgMembers(options?: { enabled?: boolean }) {
  return useQuery<OrgMember[]>({
    queryKey: organizationKeys.members(),
    queryFn: organizationApi.listMembers,
    enabled: options?.enabled ?? true,
  });
}

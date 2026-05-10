import { useMutation, useQueryClient } from "@tanstack/react-query";
import { organizationApi, type OrganizationUpdate } from "@/api/endpoints/organization.api";
import { organizationKeys } from "@/hooks/queries/use-organization-queries";

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: OrganizationUpdate) => organizationApi.updateMine(patch),
    onSuccess: (data) => {
      qc.setQueryData(organizationKeys.current(), data);
      qc.invalidateQueries({ queryKey: organizationKeys.current() });
    },
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, orgRole }: { userId: string; orgRole: string }) =>
      organizationApi.updateMemberRole(userId, orgRole),
    onSuccess: () => qc.invalidateQueries({ queryKey: organizationKeys.members() }),
  });
}

export function useSetMemberSuspended() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, suspended }: { userId: string; suspended: boolean }) =>
      organizationApi.setMemberSuspended(userId, suspended),
    onSuccess: () => qc.invalidateQueries({ queryKey: organizationKeys.members() }),
  });
}

export function useAssignMemberBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, branchId, orgRole }: { userId: string; branchId: string; orgRole?: string }) =>
      organizationApi.assignBranch(userId, branchId, orgRole),
    onSuccess: () => qc.invalidateQueries({ queryKey: organizationKeys.members() }),
  });
}

export function useUnassignMemberBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, branchId }: { userId: string; branchId: string }) =>
      organizationApi.unassignBranch(userId, branchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: organizationKeys.members() }),
  });
}

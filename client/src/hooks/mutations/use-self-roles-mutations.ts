import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { userOrgRolesApi } from "@/api/endpoints/user-org-roles.api";
import { authKeys } from "@/hooks/queries/use-auth-queries";
import type { OrgRole } from "@/types/auth/auth.types";

export const selfRolesKeys = {
  all: ["self-org-roles"] as const,
  mine: () => [...selfRolesKeys.all, "mine"] as const,
};

export function useMyOrgRoles() {
  return useQuery<OrgRole[]>({
    queryKey: selfRolesKeys.mine(),
    queryFn:  userOrgRolesApi.listMyRoles,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: selfRolesKeys.all });
    // Re-fetch current user so orgRoles, orgRole and the merged nav all refresh.
    qc.invalidateQueries({ queryKey: authKeys.currentUser() });
  };
}

export function useStartSelling() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => userOrgRolesApi.startSelling(),
    onSuccess: invalidate,
  });
}

export function useStopSelling() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => userOrgRolesApi.stopSelling(),
    onSuccess: invalidate,
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  platformAdminApi,
  type AssignableOrgRole,
  type ChangePlanPayload,
  type UsageLimitsPatch,
  type ModelPricingPatch,
} from "./platform-admin.api";
import { platformAdminKeys } from "./use-platform-admin-queries";
import { authKeys } from "@/hooks/queries/use-auth-queries";

function useInvalidateOrg() {
  const qc = useQueryClient();
  return (orgId?: string) => {
    qc.invalidateQueries({ queryKey: platformAdminKeys.orgs() });
    qc.invalidateQueries({ queryKey: [...platformAdminKeys.all, "users"] });
    qc.invalidateQueries({ queryKey: [...platformAdminKeys.all, "audit"] });
    if (orgId) {
      qc.invalidateQueries({ queryKey: platformAdminKeys.org(orgId) });
      qc.invalidateQueries({ queryKey: platformAdminKeys.orgUsers(orgId) });
      qc.invalidateQueries({ queryKey: platformAdminKeys.orgBranches(orgId) });
      qc.invalidateQueries({ queryKey: platformAdminKeys.credits(orgId) });
      qc.invalidateQueries({ queryKey: [...platformAdminKeys.all, "org", orgId, "credit-usage"] });
      qc.invalidateQueries({ queryKey: [...platformAdminKeys.all, "org", orgId, "credit-charges"] });
      qc.invalidateQueries({ queryKey: platformAdminKeys.usage(orgId) });
      qc.invalidateQueries({ queryKey: [...platformAdminKeys.all, "org", orgId, "usage-history"] });
    }
  };
}

export function useSuspendOrg() {
  const invalidate = useInvalidateOrg();
  return useMutation({
    mutationFn: ({ orgId, reason }: { orgId: string; reason: string }) =>
      platformAdminApi.suspendOrg(orgId, reason),
    onSuccess: (_d, vars) => invalidate(vars.orgId),
  });
}

export function useActivateOrg() {
  const invalidate = useInvalidateOrg();
  return useMutation({
    mutationFn: (orgId: string) => platformAdminApi.activateOrg(orgId),
    onSuccess: (_d, orgId) => invalidate(orgId),
  });
}

export function useChangeOrgPlan() {
  const invalidate = useInvalidateOrg();
  return useMutation({
    mutationFn: ({ orgId, payload }: { orgId: string; payload: ChangePlanPayload }) =>
      platformAdminApi.changeOrgPlan(orgId, payload),
    onSuccess: (_d, vars) => invalidate(vars.orgId),
  });
}

export function useChangeUserRole() {
  const invalidate = useInvalidateOrg();
  return useMutation({
    mutationFn: ({ orgId, userId, orgRole }: { orgId: string; userId: string; orgRole: AssignableOrgRole }) =>
      platformAdminApi.changeUserRole(orgId, userId, orgRole),
    onSuccess: (_d, vars) => invalidate(vars.orgId),
  });
}

export function useAddUserRole() {
  const invalidate = useInvalidateOrg();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, userId, role }: { orgId: string; userId: string; role: AssignableOrgRole }) =>
      platformAdminApi.addUserRole(orgId, userId, role),
    onSuccess: (_d, vars) => {
      invalidate(vars.orgId);
      qc.invalidateQueries({ queryKey: platformAdminKeys.userRoles(vars.orgId, vars.userId) });
    },
  });
}

export function useRemoveUserRole() {
  const invalidate = useInvalidateOrg();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, userId, role }: { orgId: string; userId: string; role: AssignableOrgRole }) =>
      platformAdminApi.removeUserRole(orgId, userId, role),
    onSuccess: (_d, vars) => {
      invalidate(vars.orgId);
      qc.invalidateQueries({ queryKey: platformAdminKeys.userRoles(vars.orgId, vars.userId) });
    },
  });
}

export function useDeactivateUser() {
  const invalidate = useInvalidateOrg();
  return useMutation({
    mutationFn: ({ orgId, userId, reason }: { orgId: string; userId: string; reason?: string }) =>
      platformAdminApi.deactivateUser(orgId, userId, reason),
    onSuccess: (_d, vars) => invalidate(vars.orgId),
  });
}

export function useReactivateUser() {
  const invalidate = useInvalidateOrg();
  return useMutation({
    mutationFn: ({ orgId, userId }: { orgId: string; userId: string }) =>
      platformAdminApi.reactivateUser(orgId, userId),
    onSuccess: (_d, vars) => invalidate(vars.orgId),
  });
}

export function useStartImpersonation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orgId: string) => platformAdminApi.startImpersonation(orgId),
    onSuccess: () => {
      // Force the whole app to re-fetch current-user context so it picks up
      // the impersonated org scope.
      qc.invalidateQueries({ queryKey: authKeys.currentUser() });
      qc.invalidateQueries({ queryKey: [...platformAdminKeys.all, "audit"] });
    },
  });
}

export function useStopImpersonation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => platformAdminApi.stopImpersonation(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.currentUser() });
      qc.invalidateQueries({ queryKey: [...platformAdminKeys.all, "audit"] });
    },
  });
}

export function useUpdateCreditLimit() {
  const invalidate = useInvalidateOrg();
  return useMutation({
    mutationFn: ({ orgId, limit, enabled }: { orgId: string; limit: number; enabled?: boolean }) =>
      platformAdminApi.updateCreditLimit(orgId, limit, enabled),
    onSuccess: (_d, vars) => invalidate(vars.orgId),
  });
}

export function useUpdateOveragePrice() {
  const invalidate = useInvalidateOrg();
  return useMutation({
    mutationFn: ({ orgId, priceCents }: { orgId: string; priceCents: number }) =>
      platformAdminApi.updateOveragePrice(orgId, priceCents),
    onSuccess: (_d, vars) => invalidate(vars.orgId),
  });
}

export function useTopUpCredits() {
  const invalidate = useInvalidateOrg();
  return useMutation({
    mutationFn: ({ orgId, credits, reason }: { orgId: string; credits: number; reason?: string }) =>
      platformAdminApi.topUpCredits(orgId, credits, reason),
    onSuccess: (_d, vars) => invalidate(vars.orgId),
  });
}

export function useWriteOffCharge() {
  const invalidate = useInvalidateOrg();
  return useMutation({
    mutationFn: ({ orgId, chargeId, reason }: { orgId: string; chargeId: string; reason?: string }) =>
      platformAdminApi.writeOffCharge(orgId, chargeId, reason),
    onSuccess: (_d, vars) => invalidate(vars.orgId),
  });
}

export function useUpdateUsageLimits() {
  const invalidate = useInvalidateOrg();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, patch }: { orgId: string; patch: UsageLimitsPatch }) =>
      platformAdminApi.updateUsageLimits(orgId, patch),
    onSuccess: (_d, vars) => {
      invalidate(vars.orgId);
      qc.invalidateQueries({ queryKey: [...platformAdminKeys.all, "usage-overview"] });
    },
  });
}

export function useUpsertModelPricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ model, patch }: { model: string; patch: ModelPricingPatch }) =>
      platformAdminApi.upsertModelPricing(model, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: platformAdminKeys.modelPricing() });
      qc.invalidateQueries({ queryKey: [...platformAdminKeys.all, "usage-overview"] });
    },
  });
}

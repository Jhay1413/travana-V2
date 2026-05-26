import { useQuery } from "@tanstack/react-query";
import {
  platformAdminApi,
  type OrgSummary,
  type AdminUserRow,
  type AdminBranchRow,
  type AdminAuditEntry,
  type AuditLogFilters,
  type UsersListFilters,
  type CreditSummary,
  type CreditUsageRow,
  type CreditChargeRow,
  type ChargesFilters,
} from "@/api/endpoints/platform-admin.api";

export const platformAdminKeys = {
  all:        ["platform-admin"] as const,
  orgs:       () => [...platformAdminKeys.all, "orgs"] as const,
  org:        (id: string) => [...platformAdminKeys.all, "org", id] as const,
  users:      (filters: UsersListFilters) => [...platformAdminKeys.all, "users", filters] as const,
  user:       (id: string) => [...platformAdminKeys.all, "user", id] as const,
  orgUsers:   (orgId: string) => [...platformAdminKeys.all, "org", orgId, "users"] as const,
  orgBranches: (orgId: string) => [...platformAdminKeys.all, "org", orgId, "branches"] as const,
  credits:     (orgId: string) => [...platformAdminKeys.all, "org", orgId, "credits"] as const,
  creditUsage: (orgId: string, months: number) => [...platformAdminKeys.all, "org", orgId, "credit-usage", months] as const,
  creditCharges: (orgId: string, filters: ChargesFilters) => [...platformAdminKeys.all, "org", orgId, "credit-charges", filters] as const,
  audit:      (filters: AuditLogFilters) => [...platformAdminKeys.all, "audit", filters] as const,
};

export function useAdminOrgs() {
  return useQuery<OrgSummary[]>({
    queryKey: platformAdminKeys.orgs(),
    queryFn:  platformAdminApi.listOrgs,
  });
}

export function useAdminOrg(id: string | undefined) {
  return useQuery<OrgSummary>({
    queryKey: platformAdminKeys.org(id ?? ""),
    queryFn:  () => platformAdminApi.getOrg(id as string),
    enabled:  !!id,
  });
}

export function useAdminUsers(filters: UsersListFilters = {}) {
  return useQuery<AdminUserRow[]>({
    queryKey: platformAdminKeys.users(filters),
    queryFn:  () => platformAdminApi.listUsers(filters),
  });
}

export function useAdminUser(id: string | undefined) {
  return useQuery<AdminUserRow>({
    queryKey: platformAdminKeys.user(id ?? ""),
    queryFn:  () => platformAdminApi.getUser(id as string),
    enabled:  !!id,
  });
}

export function useAdminOrgUsers(orgId: string | undefined) {
  return useQuery<AdminUserRow[]>({
    queryKey: platformAdminKeys.orgUsers(orgId ?? ""),
    queryFn:  () => platformAdminApi.listOrgUsers(orgId as string),
    enabled:  !!orgId,
  });
}

export function useAdminOrgBranches(orgId: string | undefined) {
  return useQuery<AdminBranchRow[]>({
    queryKey: platformAdminKeys.orgBranches(orgId ?? ""),
    queryFn:  () => platformAdminApi.listOrgBranches(orgId as string),
    enabled:  !!orgId,
  });
}

export function useAdminAuditLog(filters: AuditLogFilters = {}) {
  return useQuery<AdminAuditEntry[]>({
    queryKey: platformAdminKeys.audit(filters),
    queryFn:  () => platformAdminApi.listAuditLog(filters),
  });
}

export function useAdminCreditSummary(orgId: string | undefined) {
  return useQuery<CreditSummary>({
    queryKey: platformAdminKeys.credits(orgId ?? ""),
    queryFn:  () => platformAdminApi.getCreditSummary(orgId as string),
    enabled:  !!orgId,
  });
}

export function useAdminCreditUsage(orgId: string | undefined, months = 12) {
  return useQuery<CreditUsageRow[]>({
    queryKey: platformAdminKeys.creditUsage(orgId ?? "", months),
    queryFn:  () => platformAdminApi.getUsageHistory(orgId as string, months),
    enabled:  !!orgId,
  });
}

export function useAdminCreditCharges(orgId: string | undefined, filters: ChargesFilters = {}) {
  return useQuery<CreditChargeRow[]>({
    queryKey: platformAdminKeys.creditCharges(orgId ?? "", filters),
    queryFn:  () => platformAdminApi.listCharges(orgId as string, filters),
    enabled:  !!orgId,
  });
}

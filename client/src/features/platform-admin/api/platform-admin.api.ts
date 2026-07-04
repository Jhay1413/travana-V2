import axiosClient from "@/api/client/axios-client";

// NOTE: a global response interceptor in interceptors.ts already unwraps
// `{ success, message, data }` envelopes to just the inner `data` value, so
// here `axiosResponse.data` IS the array/object the backend put under "data".
// Do NOT do `response.data.data` — it returns undefined.

export interface OrgSummary {
  id:          string;
  name:        string;
  slug:        string;
  plan:        string | null;
  isActive:    boolean;
  seatLimit:   number | null;
  createdAt:   string;
  userCount:   number;
  branchCount: number;
}

export interface AdminUserRow {
  id:        string;
  name:      string;
  email:     string;
  firstName: string;
  lastName:  string;
  role:      string;
  orgRole:   string | null;
  orgId:     string | null;
  banned:    boolean | null;
  createdAt: string;
}

export interface AdminBranchRow {
  id:          string;
  name:        string;
  code:        string | null;
  isDefault:   boolean;
  isActive:    boolean;
  branchType:  string;
  createdAt:   string;
  memberCount: number;
}

export interface AdminAuditEntry {
  id:           string;
  actorUserId:  string;
  action:       string;
  targetOrgId:  string | null;
  targetUserId: string | null;
  metadata:     Record<string, unknown>;
  ipAddress:    string | null;
  userAgent:    string | null;
  createdAt:    string;
}

export type AssignableOrgRole =
  | "org_admin"
  | "branch_manager"
  | "agent"
  | "homeworker"
  | "referral_agent"
  | "social_media_manager";

export interface UsersListFilters {
  orgId?:  string;
  search?: string;
  limit?:  number;
  offset?: number;
}

export interface AuditLogFilters {
  actorId?: string;
  orgId?:   string;
  action?:  string;
  limit?:   number;
  offset?:  number;
}

export interface ChangePlanPayload {
  plan:      "starter" | "growth" | "pro" | "enterprise";
  seatLimit?: number;
}

export interface CreditSummary {
  enabled:           boolean;
  monthlyLimit:      number;
  overagePriceCents: number;
  currentPeriod: {
    periodStart:    string;
    creditsUsed:    number;
    creditsGranted: number;
    allowance:      number;
    remaining:      number;
    overageCredits: number;
  };
  pendingChargesCents: number;
}

export interface CreditUsageRow {
  id:             string;
  orgId:          string;
  periodStart:    string;
  creditsUsed:    number;
  creditsGranted: number;
  createdAt:      string;
  updatedAt:      string;
}

export type ChargeStatus = "pending" | "invoiced" | "paid" | "written_off";

export interface CreditChargeRow {
  id:             string;
  orgId:          string;
  smsMessageId:   string | null;
  periodStart:    string;
  credits:        number;
  unitPriceCents: number;
  amountCents:    number;
  status:         ChargeStatus;
  invoicedAt:     string | null;
  paidAt:         string | null;
  createdAt:      string;
}

export interface ChargesFilters {
  status?: ChargeStatus;
  limit?:  number;
  offset?: number;
}

const BASE = "/api/v2/platform-admin";

export const platformAdminApi = {
  // Organizations. Optional `search` filters server-side by name/slug (capped
  // to 50 results) for a searchable org picker; omitted → the full list.
  listOrgs: async (search?: string): Promise<OrgSummary[]> => {
    const qs = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
    const { data } = await axiosClient.get<OrgSummary[]>(`${BASE}/organizations${qs}`);
    return data ?? [];
  },
  getOrg: async (id: string): Promise<OrgSummary> => {
    const { data } = await axiosClient.get<OrgSummary>(`${BASE}/organizations/${id}`);
    return data;
  },
  suspendOrg: async (id: string, reason: string): Promise<void> => {
    await axiosClient.patch(`${BASE}/organizations/${id}/suspend`, { reason });
  },
  activateOrg: async (id: string): Promise<void> => {
    await axiosClient.patch(`${BASE}/organizations/${id}/activate`, {});
  },
  changeOrgPlan: async (id: string, payload: ChangePlanPayload): Promise<void> => {
    await axiosClient.patch(`${BASE}/organizations/${id}/plan`, payload);
  },

  // Users (cross-org)
  listUsers: async (filters: UsersListFilters = {}): Promise<AdminUserRow[]> => {
    const { data } = await axiosClient.get<AdminUserRow[]>(`${BASE}/users`, { params: filters });
    return data ?? [];
  },
  getUser: async (id: string): Promise<AdminUserRow> => {
    const { data } = await axiosClient.get<AdminUserRow>(`${BASE}/users/${id}`);
    return data;
  },

  // Users (org-scoped)
  listOrgUsers: async (orgId: string): Promise<AdminUserRow[]> => {
    const { data } = await axiosClient.get<AdminUserRow[]>(`${BASE}/organizations/${orgId}/users`);
    return data ?? [];
  },
  changeUserRole: async (orgId: string, userId: string, orgRole: AssignableOrgRole): Promise<void> => {
    await axiosClient.patch(`${BASE}/organizations/${orgId}/users/${userId}/role`, { orgRole });
  },

  // Multi-role per user (chip editor)
  listUserRoles: async (orgId: string, userId: string): Promise<AssignableOrgRole[]> => {
    const { data } = await axiosClient.get<{ roles: AssignableOrgRole[] }>(
      `${BASE}/organizations/${orgId}/users/${userId}/roles`,
    );
    return data?.roles ?? [];
  },
  addUserRole: async (orgId: string, userId: string, role: AssignableOrgRole): Promise<void> => {
    await axiosClient.post(`${BASE}/organizations/${orgId}/users/${userId}/roles`, { role });
  },
  removeUserRole: async (orgId: string, userId: string, role: AssignableOrgRole): Promise<void> => {
    await axiosClient.delete(`${BASE}/organizations/${orgId}/users/${userId}/roles/${role}`);
  },
  deactivateUser: async (orgId: string, userId: string, reason?: string): Promise<void> => {
    await axiosClient.patch(`${BASE}/organizations/${orgId}/users/${userId}/deactivate`, reason ? { reason } : {});
  },
  reactivateUser: async (orgId: string, userId: string): Promise<void> => {
    await axiosClient.patch(`${BASE}/organizations/${orgId}/users/${userId}/reactivate`, {});
  },

  // Branches (org-scoped, read-only)
  listOrgBranches: async (orgId: string): Promise<AdminBranchRow[]> => {
    const { data } = await axiosClient.get<AdminBranchRow[]>(`${BASE}/organizations/${orgId}/branches`);
    return data ?? [];
  },

  // Impersonation
  startImpersonation: async (orgId: string): Promise<{ orgId: string; orgName: string }> => {
    const { data } = await axiosClient.post<{ orgId: string; orgName: string }>(
      `${BASE}/organizations/${orgId}/impersonate`,
    );
    return data;
  },
  stopImpersonation: async (): Promise<void> => {
    await axiosClient.delete(`${BASE}/impersonate`);
  },

  // SMS credits (per-org)
  getCreditSummary: async (orgId: string): Promise<CreditSummary> => {
    const { data } = await axiosClient.get<CreditSummary>(`${BASE}/organizations/${orgId}/credits`);
    return data;
  },
  updateCreditLimit: async (orgId: string, limit: number, enabled?: boolean): Promise<void> => {
    await axiosClient.patch(`${BASE}/organizations/${orgId}/credits/limit`, enabled === undefined ? { limit } : { limit, enabled });
  },
  updateOveragePrice: async (orgId: string, priceCents: number): Promise<void> => {
    await axiosClient.patch(`${BASE}/organizations/${orgId}/credits/price`, { priceCents });
  },
  topUpCredits: async (orgId: string, credits: number, reason?: string): Promise<void> => {
    await axiosClient.post(`${BASE}/organizations/${orgId}/credits/topup`, reason ? { credits, reason } : { credits });
  },
  getUsageHistory: async (orgId: string, months = 12): Promise<CreditUsageRow[]> => {
    const { data } = await axiosClient.get<CreditUsageRow[]>(`${BASE}/organizations/${orgId}/credits/usage`, { params: { months } });
    return data ?? [];
  },
  listCharges: async (orgId: string, filters: ChargesFilters = {}): Promise<CreditChargeRow[]> => {
    const { data } = await axiosClient.get<CreditChargeRow[]>(`${BASE}/organizations/${orgId}/credits/charges`, { params: filters });
    return data ?? [];
  },
  writeOffCharge: async (orgId: string, chargeId: string, reason?: string): Promise<void> => {
    await axiosClient.patch(`${BASE}/organizations/${orgId}/credits/charges/${chargeId}/write-off`, reason ? { reason } : {});
  },

  // Audit log
  listAuditLog: async (filters: AuditLogFilters = {}): Promise<AdminAuditEntry[]> => {
    const { data } = await axiosClient.get<AdminAuditEntry[]>(`${BASE}/audit-log`, { params: filters });
    return data ?? [];
  },
};

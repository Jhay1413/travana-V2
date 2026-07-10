import axiosClient from "@/api/client/axios-client";

// Per-org SendSeven integration settings — PLATFORM-ADMIN only, targeting a
// specific org. The token lives encrypted server-side; the browser only ever
// sees a masked preview.

const base = (orgId: string) => `/api/v2/conversation-integration/${orgId}`;

export interface IntegrationStatus {
  configured: boolean;
  /**
   * "org"    → standalone token pasted for this org (manual override)
   * "tenant" → managed SendSeven sub-account reached via the parent token + X-Tenant-ID
   * "env"    → platform-wide fallback token
   * "none"   → nothing configured
   */
  source: "org" | "tenant" | "env" | "none";
  isActive: boolean;
  baseUrl: string | null;
  tokenMasked: string | null;
  updatedAt: string | null;
  /** SendSeven sub-account auto-provisioned for this org on onboarding, if any. */
  tenantId: string | null;
}

export interface IntegrationSummary {
  orgId: string;
  tenantId: string | null;
  hasToken: boolean;
  isActive: boolean;
}

export interface SetIntegrationInput {
  token: string;
  baseUrl?: string;
}

export interface TestResult {
  ok: boolean;
  message: string;
}

export const conversationIntegrationApi = {
  listStatuses: async (): Promise<IntegrationSummary[]> => {
    const { data } = await axiosClient.get<IntegrationSummary[]>("/api/v2/conversation-integration");
    return data;
  },
  getStatus: async (orgId: string): Promise<IntegrationStatus> => {
    const { data } = await axiosClient.get<IntegrationStatus>(base(orgId));
    return data;
  },
  setToken: async (orgId: string, input: SetIntegrationInput): Promise<IntegrationStatus> => {
    const { data } = await axiosClient.put<IntegrationStatus>(base(orgId), input);
    return data;
  },
  remove: async (orgId: string): Promise<{ ok: boolean }> => {
    const { data } = await axiosClient.delete<{ ok: boolean }>(base(orgId));
    return data;
  },
  test: async (orgId: string): Promise<TestResult> => {
    const { data } = await axiosClient.post<TestResult>(`${base(orgId)}/test`);
    return data;
  },
};

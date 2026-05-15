import type {
  TargetsOverview,
  ShopTargetData,
  AgentTargetData,
  AgentInfo,
  BulkShopTargetsInput,
  BulkAgentTargetsInput,
} from "../../types/targets/targets.types";

const API_BASE = "/api/v2/targets";

function withBranch(path: string, branchId?: string): string {
  return branchId ? `${path}?branchId=${encodeURIComponent(branchId)}` : path;
}

export const targetsApi = {
  // ─── Overview ───────────────────────────────────────────────────────────
  async getOverview(branchId?: string): Promise<TargetsOverview> {
    const response = await fetch(withBranch(`${API_BASE}/overview`, branchId));
    if (!response.ok) {
      throw new Error("Failed to fetch targets overview");
    }
    return response.json();
  },

  // ─── Shop Targets ───────────────────────────────────────────────────────────
  async getShopTargets(branchId?: string): Promise<ShopTargetData[]> {
    const response = await fetch(withBranch(`${API_BASE}/shop`, branchId));
    if (!response.ok) {
      throw new Error("Failed to fetch shop targets");
    }
    return response.json();
  },

  async upsertShopTargets(input: BulkShopTargetsInput, branchId?: string): Promise<ShopTargetData[]> {
    const response = await fetch(`${API_BASE}/shop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, branchId }),
    });
    if (!response.ok) {
      throw new Error("Failed to upsert shop targets");
    }
    return response.json();
  },

  // ─── Agent Targets ───────────────────────────────────────────────────────────
  async getAgentTargets(branchId?: string): Promise<AgentTargetData[]> {
    const response = await fetch(withBranch(`${API_BASE}/agent`, branchId));
    if (!response.ok) {
      throw new Error("Failed to fetch agent targets");
    }
    return response.json();
  },

  async getAgentTargetsByUserId(userId: string, branchId?: string): Promise<AgentTargetData[]> {
    const response = await fetch(withBranch(`${API_BASE}/agent/${userId}`, branchId));
    if (!response.ok) {
      throw new Error("Failed to fetch agent targets by user ID");
    }
    return response.json();
  },

  async upsertAgentTargets(input: BulkAgentTargetsInput, branchId?: string): Promise<AgentTargetData[]> {
    const response = await fetch(`${API_BASE}/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, branchId }),
    });
    if (!response.ok) {
      throw new Error("Failed to upsert agent targets");
    }
    return response.json();
  },

  // ─── Agents ───────────────────────────────────────────────────────────
  async getAgents(branchId?: string): Promise<AgentInfo[]> {
    const response = await fetch(withBranch(`${API_BASE}/agents`, branchId));
    if (!response.ok) {
      throw new Error("Failed to fetch agents");
    }
    return response.json();
  },
};

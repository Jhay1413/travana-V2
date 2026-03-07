import type {
  TargetsOverview,
  ShopTargetData,
  AgentTargetData,
  AgentInfo,
  BulkShopTargetsInput,
  BulkAgentTargetsInput,
} from "../../types/targets/targets.types";

const API_BASE = "/api/targets";

export const targetsApi = {
  // ─── Overview ───────────────────────────────────────────────────────────
  async getOverview(): Promise<TargetsOverview> {
    const response = await fetch(`${API_BASE}/overview`);
    if (!response.ok) {
      throw new Error("Failed to fetch targets overview");
    }
    return response.json();
  },

  // ─── Shop Targets ───────────────────────────────────────────────────────────
  async getShopTargets(): Promise<ShopTargetData[]> {
    const response = await fetch(`${API_BASE}/shop`);
    if (!response.ok) {
      throw new Error("Failed to fetch shop targets");
    }
    return response.json();
  },

  async upsertShopTargets(input: BulkShopTargetsInput): Promise<ShopTargetData[]> {
    const response = await fetch(`${API_BASE}/shop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error("Failed to upsert shop targets");
    }
    return response.json();
  },

  // ─── Agent Targets ───────────────────────────────────────────────────────────
  async getAgentTargets(): Promise<AgentTargetData[]> {
    const response = await fetch(`${API_BASE}/agent`);
    if (!response.ok) {
      throw new Error("Failed to fetch agent targets");
    }
    return response.json();
  },

  async getAgentTargetsByUserId(userId: string): Promise<AgentTargetData[]> {
    const response = await fetch(`${API_BASE}/agent/${userId}`);
    if (!response.ok) {
      throw new Error("Failed to fetch agent targets by user ID");
    }
    return response.json();
  },

  async upsertAgentTargets(input: BulkAgentTargetsInput): Promise<AgentTargetData[]> {
    const response = await fetch(`${API_BASE}/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error("Failed to upsert agent targets");
    }
    return response.json();
  },

  // ─── Agents ───────────────────────────────────────────────────────────
  async getAgents(): Promise<AgentInfo[]> {
    const response = await fetch(`${API_BASE}/agents`);
    if (!response.ok) {
      throw new Error("Failed to fetch agents");
    }
    return response.json();
  },
};

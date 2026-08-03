// ─── Shop Target Types ───────────────────────────────────────────────────────

export interface ShopTargetData {
  id: string;
  year: number;
  month: number;
  targetAmount: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopTargetInput {
  year: number;
  month: number;
  targetAmount: string;
}

// ─── Agent Target Types ───────────────────────────────────────────────────────

export interface AgentTargetData {
  id: string;
  userId: string;
  year: number;
  month: number;
  targetAmount: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentTargetInput {
  userId: string;
  year: number;
  month: number;
  targetAmount: string;
}

// ─── Agent Info ───────────────────────────────────────────────────────────

export interface AgentInfo {
  id: string;
  name: string;
  email: string;
  role: string;
}

// ─── Target Summary ───────────────────────────────────────────────────────────

export type TargetBalanceStatus = "balanced" | "over" | "under";

export interface MonthTargetSummary {
  year: number;
  month: number;
  monthName: string;
  shopTarget: string;
  totalAgentTargets: string;
  difference: string;
  status: TargetBalanceStatus;
}

// ─── Bulk Operations ───────────────────────────────────────────────────────────

export interface BulkShopTargetsInput {
  targets: ShopTargetInput[];
}

export interface BulkAgentTargetsInput {
  targets: AgentTargetInput[];
}

// ─── Response Types ───────────────────────────────────────────────────────────

export interface TargetsOverview {
  shopTargets: ShopTargetData[];
  agentTargets: AgentTargetData[];
  agents: AgentInfo[];
  summary: MonthTargetSummary[];
}

export interface ShopTargetData {
  id: string;
  year: number;
  month: number;
  targetAmount: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShopTargetInput {
  year: number;
  month: number;
  targetAmount: string;
}

export interface AgentTargetData {
  id: string;
  userId: string;
  year: number;
  month: number;
  targetAmount: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentTargetInput {
  userId: string;
  year: number;
  month: number;
  targetAmount: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface MonthTargetSummary {
  year: number;
  month: number;
  monthName: string;
  shopTarget: string;
  totalAgentTargets: string;
  difference: string;
}

export interface BulkShopTargetsInput {
  targets: ShopTargetInput[];
}

export interface BulkAgentTargetsInput {
  targets: AgentTargetInput[];
}

export interface TargetsOverview {
  shopTargets: ShopTargetData[];
  agentTargets: AgentTargetData[];
  agents: AgentInfo[];
  summary: MonthTargetSummary[];
}

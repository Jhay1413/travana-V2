export interface ShopTargetData {
  id: string;
  branchId: string;
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
  branchId: string;
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

export interface BulkShopTargetsInput {
  targets: ShopTargetInput[];
}

export interface BulkAgentTargetsInput {
  targets: AgentTargetInput[];
}

export interface TargetsOverview {
  branchId: string;
  shopTargets: ShopTargetData[];
  agentTargets: AgentTargetData[];
  agents: AgentInfo[];
  summary: MonthTargetSummary[];
}

// ─── Year view (redesign) ────────────────────────────────────────────────

/** Twelve whole-pound figures, January to December. */
export type MonthAmounts = number[];

export interface YearBusinessRow {
  months: MonthAmounts;
  actual: MonthAmounts;
}

export interface YearBranchRow {
  id: string;
  name: string;
  months: MonthAmounts;
  actual: MonthAmounts;
}

export interface YearAgentRow {
  userId: string;
  name: string;
  branchId: string;
  months: MonthAmounts;
  actual: MonthAmounts;
  /** True for a deactivated member who still carries a non-zero target this year. */
  inactive?: true;
}

export interface YearHomeworkerRow {
  userId: string;
  branchId: string;
  name: string;
  /** Effective target per month. */
  months: MonthAmounts;
  /** The owner's own figure per month; null where they never set one. */
  selfMonths: (number | null)[];
  /** 'admin' when any month of the year is currently overridden by an admin. */
  source: "self" | "admin";
  note: string | null;
  actual: MonthAmounts;
}

export interface YearCanEdit {
  business: boolean;
  shopBranchIds: string[];
  agentBranchIds: string[];
  homeworkers: boolean;
  /** A homeworker may set their own target (PUT /targets/mine). */
  mine: boolean;
}

export interface TargetsYear {
  year: number;
  /** Share of the year elapsed in Europe/London, 0..1 (past year 1, future year 0). */
  elapsed: number;
  /** London month 1-12 for the current year; 12 for a past year; 0 for a future year. */
  currentMonth: number;
  business: YearBusinessRow | null;
  branches: YearBranchRow[];
  agents: YearAgentRow[];
  homeworkers: YearHomeworkerRow[];
  canEdit: YearCanEdit;
}

export interface BranchRecord {
  id: string;
  name: string;
  branchType: "shop" | "homeworker";
  ownerUserId: string | null;
  ownerName: string | null;
  isActive: boolean;
}

export interface MemberRecord {
  branchId: string;
  userId: string;
  name: string;
  isActive: boolean;
}

export interface MonthAmountRow {
  month: number;
  amount: string;
}

export interface BranchMonthAmountRow extends MonthAmountRow {
  branchId: string;
}

/** An agent_target_table row as the year view and override logic need it. */
export interface AgentTargetRowData {
  branchId: string;
  userId: string;
  year: number;
  month: number;
  targetAmount: string;
  source: string;
  selfAmount: string | null;
  note: string | null;
  updatedBy: string | null;
  updatedAt: Date | null;
}

export interface AgentTargetRowWrite {
  branchId: string;
  userId: string;
  year: number;
  month: number;
  targetAmount: string;
  source: "self" | "admin";
  selfAmount: string | null;
  note: string | null;
  updatedBy: string | null;
}

/** Booking + upsell commission for one (branch, agent, London month). */
export interface ActualRow {
  branchId: string;
  userId: string;
  month: number;
  amount: number;
}

export interface ActualsFilter {
  branchIds?: string[];
  userId?: string;
}

// ─── Writes ──────────────────────────────────────────────────────────────

export interface AllocationInput {
  year: number;
  business?: { months: MonthAmounts };
  shops?: { branchId: string; months: MonthAmounts }[];
  agents?: { branchId: string; userId: string; months: MonthAmounts }[];
}

export interface MonthsInput {
  year: number;
  months: MonthAmounts;
}

export interface OverrideInput extends MonthsInput {
  note?: string | null;
}

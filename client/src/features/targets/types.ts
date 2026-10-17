/** Twelve whole-pound amounts, January first. */
export type MonthAmounts = number[];

export interface BusinessYear {
  months: MonthAmounts;
  actual: MonthAmounts;
}

export interface BranchYear {
  id: string;
  name: string;
  months: MonthAmounts;
  actual: MonthAmounts;
}

export interface AgentYear {
  userId: string;
  name: string;
  branchId: string;
  months: MonthAmounts;
  actual: MonthAmounts;
  inactive?: boolean;
}

export type HomeworkerSource = "self" | "admin";

export interface HomeworkerYear {
  userId: string;
  branchId: string;
  name: string;
  /** The target that counts (the admin override when there is one). */
  months: MonthAmounts;
  /** What the homeworker set for themselves; null for months they left empty. */
  selfMonths: Array<number | null>;
  source: HomeworkerSource;
  note: string | null;
  actual: MonthAmounts;
}

export interface TargetsCanEdit {
  business: boolean;
  shopBranchIds: string[];
  agentBranchIds: string[];
  homeworkers: boolean;
  /** True for a homeworker who owns their branch: they may set their own target. */
  mine: boolean;
}

export interface TargetsYear {
  year: number;
  /** Share of the year gone, 0 to 1. */
  elapsed: number;
  /** 1 to 12: the month that is "to date". Months before it are complete. */
  currentMonth: number;
  business: BusinessYear | null;
  branches: BranchYear[];
  agents: AgentYear[];
  homeworkers: HomeworkerYear[];
  canEdit: TargetsCanEdit;
}

export interface AllocationInput {
  year: number;
  business?: { months: MonthAmounts };
  shops?: Array<{ branchId: string; months: MonthAmounts }>;
  agents?: Array<{ branchId: string; userId: string; months: MonthAmounts }>;
}

export interface MonthsInput {
  year: number;
  months: MonthAmounts;
}

export interface OverrideInput extends MonthsInput {
  note?: string;
}

/** The wizard's working numbers, kept as the text typed into each box. */
export interface Plan {
  business: string;
  /** Keyed by branch id. */
  shops: Record<string, string>;
  /** Keyed by user id. */
  agents: Record<string, string>;
}

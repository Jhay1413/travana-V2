import type { OpeningPattern } from "../../utils/leave-days";

export type { OpeningPattern };
export type ComparatorScope = "organisation" | "branch";

export interface AgentProfileBranch {
  id: string;
  name: string;
  branchType: "shop" | "homeworker";
  openingPattern: OpeningPattern | null;
  orgRole: string;
  isActive: boolean;
  joinedAt: string;
}

export interface AgentProfileDeal {
  bookingId: string;
  transactionId: string;
  clientId: string | null;
  clientName: string | null;
  title: string | null;
  bookedAt: string | null;
  travelDate: string;
  salesPrice: number;
  commission: number;
}

export interface AgentProfileHeader {
  user: { id: string; name: string; firstName: string; lastName: string; email: string; phone: string; image: string | null };
  organisationName: string;
  roles: string[];
  primaryRole: string | null;
  branches: AgentProfileBranch[];
  isSuspended: boolean;
  isHomeworker: boolean;
  /** profitSharePercent is null unless the viewer can see pay. */
  homeworker: { branchId: string; branchName: string; isActive: boolean; profitSharePercent: number | null } | null;
  startedAt: string;
  startedAtSource: "hr" | "membership" | "account";
  openDeals: number;
  biggestDeal: AgentProfileDeal | null;
  bestMonth: { month: string; profit: number } | null;
  lifetimeProfit: number;
  viewer: { isAdmin: boolean; canSeePay: boolean; comparatorScope: ComparatorScope; comparatorLabel: string };
}

export interface AgentProfileComparator {
  scope: ComparatorScope;
  label: string;
}

export interface AgentProfilePerformance {
  window: { from: string; to: string };
  profit: number;
  bookings: number;
  sales: number;
  ppb: number;
  quotesSent: number;
  quotedDeals: number;
  quoteViews: number;
  closeRate: number;
  commissionRate: number | null;
  comparator: AgentProfileComparator & {
    profit: number;
    bookings: number;
    sales: number;
    avgCommissionRate: number | null;
  };
}

export type AgentProfileWeekItem =
  | { kind: "departure"; id: string; transactionId: string; clientId: string | null; clientName: string | null; title: string | null }
  | {
      kind: "task";
      id: string;
      title: string | null;
      dueAt: string;
      entityType: string | null;
      entityId: string | null;
      clientId: string | null;
      clientName: string | null;
      entityTitle: string | null;
    };

export interface AgentProfileWeek {
  start: string;
  days: { date: string; items: AgentProfileWeekItem[] }[];
}

export interface AgentProfileMonthPoint {
  month: string;
  profit: number;
}

export interface AgentProfileMonthly {
  year: number;
  currentMonth: number;
  months: AgentProfileMonthPoint[];
  comparator: AgentProfileComparator & { months: AgentProfileMonthPoint[] };
  targets: number[];
}

export interface AgentProfileCourse {
  enrollmentId: string;
  courseId: string;
  title: string;
  category: string;
  status: "in_progress" | "completed";
  enrolledAt: string;
  completedAt: string | null;
  lessonsTotal: number;
  lessonsCompleted: number;
  progressPct: number;
  certificate: { issuedAt: string; certificateNo: string | null } | null;
}

export interface AgentProfileTraining {
  courses: AgentProfileCourse[];
}

export interface AgentProfilePayoutRow {
  periodStart: string;
  /** Exclusive end, as stored on the statement. */
  periodEnd: string;
  gross: string;
  sharePercent: string;
  homeworkerShare: string;
  status: "due" | "draft" | "paid";
  finalisedAt: string | null;
  live: boolean;
}

export interface AgentProfilePayouts {
  branchId: string;
  branchName: string;
  sharePercent: string | null;
  rows: AgentProfilePayoutRow[];
}

// --- Internal (service/repository) shapes ---

/** Resolved caller access, produced by resolveAccess. */
export interface AgentProfileAccess {
  orgId: string;
  /** Set for branch managers: every deal read is narrowed to this branch. */
  branchId: string | null;
  isAdmin: boolean;
  canSeePay: boolean;
}

/** Filter every deal query starts from: org first (fail closed), then optional branch and agent. */
export interface DealFilter {
  orgId: string;
  branchId?: string;
  userId?: string;
}

export interface TimeWindow {
  from: Date;
  to: Date;
}

export interface MembershipRow {
  branchId: string;
  branchName: string;
  branchType: string;
  openingPattern: string | null;
  orgRole: string;
  isActive: boolean;
  joinedAt: Date;
}

export interface SubjectUserRow {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  image: string | null;
  createdAt: Date;
  hrStartDate: string | null;
  organisationName: string | null;
}

export interface DealRow {
  bookingId: string;
  transactionId: string;
  clientId: string | null;
  clientFirstName: string | null;
  clientSurname: string | null;
  title: string | null;
  bookedAt: Date | null;
  travelDate: string;
  salesPrice: number;
  commission: number;
}

export interface WindowTotals {
  profit: number;
  bookings: number;
  sales: number;
}

export interface QuoteWindowCounts {
  quotesSent: number;
  quotedDeals: number;
}

export interface DepartureRow {
  bookingId: string;
  transactionId: string;
  clientId: string | null;
  clientFirstName: string | null;
  clientSurname: string | null;
  travelDate: string;
  title: string | null;
}

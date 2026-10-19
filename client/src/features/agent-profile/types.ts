// Mirror of the /api/v2/agent-profile contract (server/v2/modules/agent-profile).

export type ComparatorScope = "organisation" | "branch";
export type OpeningPattern = "mon-fri" | "mon-sat" | "seven-days";

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

export interface AgentProfileUser {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  image: string | null;
}

export interface AgentProfileHeader {
  user: AgentProfileUser;
  organisationName: string;
  roles: string[];
  primaryRole: string | null;
  branches: AgentProfileBranch[];
  isSuspended: boolean;
  isHomeworker: boolean;
  homeworker: { branchId: string; branchName: string; isActive: boolean; profitSharePercent: number | null } | null;
  startedAt: string;
  startedAtSource: "hr" | "membership" | "account";
  openDeals: number;
  biggestDeal: AgentProfileDeal | null;
  bestMonth: { month: string; profit: number } | null;
  lifetimeProfit: number;
  viewer: { isAdmin: boolean; canSeePay: boolean; comparatorScope: ComparatorScope; comparatorLabel: string };
}

export interface AgentProfileWindow {
  from: string;
  to: string;
}

export interface AgentProfilePerformance {
  window: AgentProfileWindow;
  profit: number;
  bookings: number;
  sales: number;
  ppb: number;
  quotesSent: number;
  quotedDeals: number;
  quoteViews: number;
  closeRate: number;
  commissionRate: number | null;
  comparator: {
    scope: ComparatorScope;
    label: string;
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

export interface AgentProfileWeekDay {
  date: string;
  items: AgentProfileWeekItem[];
}

export interface AgentProfileWeek {
  start: string;
  days: AgentProfileWeekDay[];
}

export interface AgentProfileMonthPoint {
  month: string;
  profit: number;
}

export interface AgentProfileMonthly {
  year: number;
  currentMonth: number;
  months: AgentProfileMonthPoint[];
  comparator: { scope: ComparatorScope; label: string; months: AgentProfileMonthPoint[] };
  targets: number[];
}

export interface AgentProfileCourse {
  enrollmentId: string;
  courseId: string;
  title: string;
  category: string | null;
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

export type ProfileTab = "overview" | "earnings" | "training" | "hr" | "pipeline";

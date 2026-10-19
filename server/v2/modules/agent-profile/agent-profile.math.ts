import type { HomeworkerPayoutStatement } from "@shared/schema";
import { ukDateString } from "../../utils/london-dates";
import type { TaskWithClient } from "../task/task.repository";
import type { EnrollmentDetailRow } from "../training/training-progress.repository";
import type {
  AgentProfileCourse,
  AgentProfileDeal,
  AgentProfileMonthPoint,
  AgentProfilePayoutRow,
  AgentProfileWeek,
  AgentProfileWeekItem,
  DealRow,
  DepartureRow,
  MembershipRow,
} from "./agent-profile.types";

const DAY_MS = 86_400_000;

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Commission as a percentage of sales; null when there were no sales. */
export function commissionRate(profit: number, sales: number): number | null {
  return sales > 0 ? round2((profit / sales) * 100) : null;
}

export function clientName(first: string | null, last: string | null): string | null {
  const name = [first, last].filter((p): p is string => Boolean(p && p.trim())).join(" ").trim();
  return name || null;
}

export function toDeal(row: DealRow): AgentProfileDeal {
  return {
    bookingId: row.bookingId,
    transactionId: row.transactionId,
    clientId: row.clientId,
    clientName: clientName(row.clientFirstName, row.clientSurname),
    title: row.title,
    bookedAt: row.bookedAt ? row.bookedAt.toISOString() : null,
    travelDate: row.travelDate,
    salesPrice: row.salesPrice,
    commission: row.commission,
  };
}

/** 12 months ("YYYY-MM") of whole-pound profit from (month 1-12, amount) rows. */
export function toMonthSeries(rows: { month: number; amount: number }[], year: number): AgentProfileMonthPoint[] {
  const totals = new Array<number>(12).fill(0);
  for (const r of rows) {
    if (r.month >= 1 && r.month <= 12) totals[r.month - 1] += r.amount;
  }
  return totals.map((amount, i) => ({ month: `${year}-${String(i + 1).padStart(2, "0")}`, profit: Math.round(amount) }));
}

/** The strongest month (earliest on a tie); null when nothing was earned. */
export function pickBestMonth(months: AgentProfileMonthPoint[]): AgentProfileMonthPoint | null {
  let best: AgentProfileMonthPoint | null = null;
  for (const m of months) {
    if (m.profit > 0 && (best === null || m.profit > best.profit)) best = m;
  }
  return best;
}

/**
 * HR start date, else the earliest branch membership in the organisation, else the account creation.
 * Always a London YYYY-MM-DD, so a 00:30 BST join does not show as the previous day.
 */
export function resolveStartedAt(
  hrStartDate: string | null,
  earliestJoinedAt: Date | null,
  accountCreatedAt: Date,
): { startedAt: string; source: "hr" | "membership" | "account" } {
  if (hrStartDate) return { startedAt: hrStartDate, source: "hr" };
  if (earliestJoinedAt) return { startedAt: ukDateString(earliestJoinedAt), source: "membership" };
  return { startedAt: ukDateString(accountCreatedAt), source: "account" };
}

/** YYYY-MM-DD plus whole days (calendar arithmetic, no timezone involved). */
export function addDaysYmd(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Seven Mon-Sun days from `start`, with departures (by travel date) and tasks (by their London due
 * day, so a 23:30 UTC task in summer lands on the next London day) in each. Tasks sort by time.
 */
export function bucketWeek(start: string, departures: DepartureRow[], tasks: TaskWithClient[]): AgentProfileWeek {
  const days = Array.from({ length: 7 }, (_, i) => ({ date: addDaysYmd(start, i), items: [] as AgentProfileWeekItem[] }));
  const byDate = new Map(days.map((d) => [d.date, d] as const));

  for (const d of departures) {
    byDate.get(d.travelDate)?.items.push({
      kind: "departure",
      id: d.bookingId,
      transactionId: d.transactionId,
      clientId: d.clientId,
      clientName: clientName(d.clientFirstName, d.clientSurname),
      title: d.title,
    });
  }

  const dated = tasks
    .filter((t): t is TaskWithClient & { dueDate: Date } => t.dueDate instanceof Date)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  for (const t of dated) {
    byDate.get(ukDateString(t.dueDate))?.items.push({
      kind: "task",
      id: t.id,
      title: t.title ?? null,
      dueAt: t.dueDate.toISOString(),
      entityType: t.entityType ?? null,
      entityId: t.entityId ?? null,
      clientId: t.clientId,
      clientName: t.clientName,
      entityTitle: t.entityTitle,
    });
  }
  return { start, days };
}

export function toCourse(row: EnrollmentDetailRow): AgentProfileCourse {
  const completed = row.status === "completed";
  const progressPct = completed ? 100 : row.lessonsTotal > 0 ? Math.round((row.lessonsCompleted / row.lessonsTotal) * 100) : 0;
  return {
    enrollmentId: row.enrollmentId,
    courseId: row.courseId,
    title: row.title,
    category: row.category,
    status: completed ? "completed" : "in_progress",
    enrolledAt: row.enrolledAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    lessonsTotal: row.lessonsTotal,
    lessonsCompleted: row.lessonsCompleted,
    progressPct,
    certificate: row.certificate
      ? { issuedAt: row.certificate.issuedAt.toISOString(), certificateNo: row.certificate.certificateNo }
      : null,
  };
}

/** A computed (not stored) statement for the current period. */
export interface LiveStatement {
  periodStart: string;
  periodEnd: string;
  gross: string;
  sharePercent: string;
  homeworkerShare: string;
  finalised: boolean;
}

/**
 * Stored statements newest first, preceded by the live current-month row when that month is not
 * stored yet. final -> paid, draft -> draft, live and not finalised -> due.
 * NOTE (accepted): statements use the homeworker statement basis (gross = commission - discounts -
 * service charge), which differs from the profile's "Paid out" tile (profit x share).
 */
export function buildPayoutRows(
  stored: HomeworkerPayoutStatement[],
  live: LiveStatement | null,
  currentPeriodStart: string,
): AgentProfilePayoutRow[] {
  const rows: AgentProfilePayoutRow[] = [];
  if (live && !stored.some((s) => s.periodStart === currentPeriodStart)) {
    rows.push({
      periodStart: live.periodStart,
      periodEnd: live.periodEnd,
      gross: live.gross,
      sharePercent: live.sharePercent,
      homeworkerShare: live.homeworkerShare,
      status: live.finalised ? "paid" : "due",
      finalisedAt: null,
      live: true,
    });
  }
  for (const s of stored) {
    rows.push({
      periodStart: s.periodStart,
      periodEnd: s.periodEnd,
      gross: s.grossProfit,
      sharePercent: s.sharePercent,
      homeworkerShare: s.homeworkerShare,
      status: s.status === "final" ? "paid" : "draft",
      finalisedAt: s.finalisedAt ? s.finalisedAt.toISOString() : null,
      live: false,
    });
  }
  return rows;
}

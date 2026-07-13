import { AppError } from "../../utils/error-handler";
import { hasAnyRole, type Scope } from "../../utils/scope";
import {
  internalChatAnalyticsRepository,
  type AnalyticsScopeLevel,
  type ResolvedAnalyticsScope,
} from "./internal-chat-analytics.repository";

// Business logic for the internal-chat assistant's analytics tool: decides
// WHO is allowed to see WHAT (resolveAnalyticsAccess — fail-closed), resolves
// the requested time window, and derives the enquiry->quote and
// quote->booking conversion rates from the repository's real counts. No
// numbers are ever fabricated here — this is pure arithmetic over DB counts.

export type PipelinePeriod = "today" | "this_week" | "this_month" | "this_year" | "custom";

export const PIPELINE_PERIODS: readonly PipelinePeriod[] = [
  "today",
  "this_week",
  "this_month",
  "this_year",
  "custom",
];

export type PipelineScopeLevel = AnalyticsScopeLevel;

export interface ResolvedPeriod {
  from: Date;
  to: Date;
  label: string;
}

export interface PipelineAnswer {
  window: string;
  scopeLevel: PipelineScopeLevel;
  enquiries: number;
  quotes: number;
  bookings: number;
  enquiryToQuoteRate: number;
  quoteToBookingRate: number;
}

// The access decision for a caller: whether they may see pipeline data at
// all, and — if so — at what level and against which id(s). FAIL CLOSED:
// any role/branch/user combination that isn't explicitly recognized as
// permitted comes back `allowed: false` rather than falling back to a wider
// scope.
export interface AnalyticsAccess {
  allowed: boolean;
  level: PipelineScopeLevel;
  orgId?: string;
  branchId?: string;
  userId?: string;
  reason?: string;
}

// Decides pipeline-data access strictly by role, highest privilege first
// (mirrors the existing Reports module's gating: branch_manager/org_admin/
// platform_admin see broader data; agents/homeworkers see only their own).
// Every branch below is a closed decision — there is no fallback that
// widens scope when an expected id (branchId/userId) is missing.
export function resolveAnalyticsAccess(scope: Scope): AnalyticsAccess {
  if (hasAnyRole(scope.orgRoles, ["platform_admin"])) {
    return { allowed: true, level: "all" };
  }
  if (hasAnyRole(scope.orgRoles, ["org_admin"])) {
    return { allowed: true, level: "org", orgId: scope.orgId };
  }
  if (hasAnyRole(scope.orgRoles, ["branch_manager"])) {
    if (!scope.branchId) {
      return {
        allowed: false,
        level: "branch",
        reason: "Your account isn't assigned to a branch, so pipeline data isn't available to you.",
      };
    }
    return { allowed: true, level: "branch", orgId: scope.orgId, branchId: scope.branchId };
  }
  if (hasAnyRole(scope.orgRoles, ["agent", "homeworker"])) {
    if (!scope.userId) {
      return {
        allowed: false,
        level: "own",
        reason: "We couldn't identify your account, so pipeline data isn't available to you.",
      };
    }
    return { allowed: true, level: "own", orgId: scope.orgId, userId: scope.userId };
  }
  // referral_agent, social_media_manager, or any unrecognized role.
  return { allowed: false, level: "own", reason: "You don't have access to pipeline data." };
}

function toResolvedScope(access: AnalyticsAccess): ResolvedAnalyticsScope {
  return { level: access.level, orgId: access.orgId, branchId: access.branchId, userId: access.userId };
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d: Date): Date {
  const today = startOfDay(d);
  const dayOfWeek = today.getDay() || 7;
  const monday = new Date(today);
  monday.setDate(monday.getDate() - (dayOfWeek - 1));
  return monday;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

// Parses a YYYY-MM-DD string into a LOCAL midnight Date using its Y/M/D
// components directly. `new Date("YYYY-MM-DD")` parses as UTC midnight,
// which — combined with startOfDay's use of local getFullYear/getMonth/
// getDate — causes an off-by-one day on servers running behind UTC
// (negative UTC offset). Returns an Invalid Date if the string doesn't match.
function parseIsoDateLocal(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(NaN);
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

// Resolves period -> a half-open [from, to) window, mirroring the
// startOf*/half-open convention used by organization-overview.repository's
// funnel queries. `custom` takes ISO (YYYY-MM-DD) from/to, inclusive of
// both calendar days.
export function resolvePeriod(period: PipelinePeriod, from?: string, to?: string): ResolvedPeriod {
  const now = new Date();
  switch (period) {
    case "today": {
      const start = startOfDay(now);
      return { from: start, to: addDays(start, 1), label: "today" };
    }
    case "this_week": {
      const start = startOfWeek(now);
      return { from: start, to: addDays(start, 7), label: "this week" };
    }
    case "this_month": {
      const start = startOfMonth(now);
      const nextMonth = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      return { from: start, to: nextMonth, label: "this month" };
    }
    case "this_year": {
      const start = startOfYear(now);
      const nextYear = new Date(start.getFullYear() + 1, 0, 1);
      return { from: start, to: nextYear, label: "this year" };
    }
    case "custom": {
      if (!from || !to) {
        throw new AppError("'from' and 'to' are required when period is 'custom'", 400);
      }
      const f = parseIsoDateLocal(from);
      const t = parseIsoDateLocal(to);
      if (isNaN(f.getTime()) || isNaN(t.getTime())) {
        throw new AppError("Invalid date format. Use YYYY-MM-DD.", 400);
      }
      if (f > t) throw new AppError("'from' must be on or before 'to'", 400);
      return { from: f, to: addDays(t, 1), label: `${from} to ${to}` };
    }
    default: {
      const exhaustiveCheck: never = period;
      throw new AppError(`Unsupported period: ${String(exhaustiveCheck)}`, 400);
    }
  }
}

export const internalChatAnalyticsService = {
  async getPipelineAnswer(
    scope: Scope,
    period: PipelinePeriod,
    from?: string,
    to?: string,
  ): Promise<PipelineAnswer> {
    const access = resolveAnalyticsAccess(scope);
    if (!access.allowed) {
      throw new AppError(access.reason ?? "You don't have access to pipeline data.", 403);
    }

    const resolved = resolvePeriod(period, from, to);
    const stats = await internalChatAnalyticsRepository.getPipelineStats({
      resolvedScope: toResolvedScope(access),
      from: resolved.from,
      to: resolved.to,
    });

    const enquiryToQuoteRate =
      stats.enquiries > 0 ? Math.round((stats.quotes / stats.enquiries) * 100) : 0;
    const quoteToBookingRate = stats.quotes > 0 ? Math.round((stats.bookings / stats.quotes) * 100) : 0;

    return {
      window: resolved.label,
      scopeLevel: access.level,
      enquiries: stats.enquiries,
      quotes: stats.quotes,
      bookings: stats.bookings,
      enquiryToQuoteRate,
      quoteToBookingRate,
    };
  },
};

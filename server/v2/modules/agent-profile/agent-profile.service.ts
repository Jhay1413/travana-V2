import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";
import { ukYearMonth } from "../../utils/london-dates";
import { londonMidnight } from "../../utils/uk-time";
import { toOpeningPattern } from "../../utils/leave-days";
import { closeRatePercent, perBooking } from "../organization-overview/organization-overview.math";
import { organizationOverviewCompareRepository } from "../organization-overview/organization-overview-compare.repository";
import * as targetsRepository from "../targets/targets.repository";
import { getMemberYearTargets, yearProgress } from "../targets/targets.service";
import { homeworkerRepository } from "../homeworker/homeworker.repository";
import { userOrgRolesService, primaryRole } from "../user-org-roles/user-org-roles.service";
import { agentProfileRepository } from "./agent-profile.repository";
import { loadSubjectContext, resolveComparator, type SubjectContext } from "./agent-profile.context";
import {
  commissionRate,
  pickBestMonth,
  resolveStartedAt,
  toDeal,
  toMonthSeries,
} from "./agent-profile.math";
import type {
  AgentProfileBranch,
  AgentProfileDeal,
  AgentProfileHeader,
  AgentProfileMonthly,
  AgentProfilePerformance,
  MembershipRow,
  TimeWindow,
} from "./agent-profile.types";

const DEFAULT_DEAL_LIMIT = 5;

// NOTE (accepted risk): profit, lifetime profit and best month keep LOST bookings in, exactly like the
// dashboards and the targets pages, so the profile agrees with them. Biggest deals are the exception:
// LOST bookings are excluded there (user decision). Close rate is bookings / quoted
// deals in the window (organisation-overview definition), not a cohort.

function toBranch(m: MembershipRow): AgentProfileBranch {
  return {
    id: m.branchId,
    name: m.branchName,
    branchType: m.branchType === "homeworker" ? "homeworker" : "shop",
    openingPattern: m.openingPattern ? toOpeningPattern(m.openingPattern) : null,
    orgRole: m.orgRole,
    isActive: m.isActive,
    joinedAt: m.joinedAt.toISOString(),
  };
}

/** Branch managers are limited to their own branch for the targets/actuals reads too. */
function actualsFilter(ctx: SubjectContext) {
  return ctx.access.branchId
    ? { userId: ctx.userId, branchIds: [ctx.access.branchId] }
    : { userId: ctx.userId };
}

export const agentProfileService = {
  async getHeader(scope: Scope, userId: string, now: Date = new Date()): Promise<AgentProfileHeader> {
    const ctx = await loadSubjectContext(scope, userId);
    const { access, memberships } = ctx;
    const year = ukYearMonth(now).year;

    const [subject, roles, homeworkerBranch, openDeals, actuals, lifetimeProfit, biggest, comparator] = await Promise.all([
      agentProfileRepository.findSubjectUser(userId, access.orgId),
      userOrgRolesService.listForUser(userId, access.orgId),
      homeworkerRepository.findByOwner(access.orgId, userId),
      organizationOverviewCompareRepository.getOpenDealCounts(access.orgId, access.branchId ?? undefined, userId),
      targetsRepository.getActualsForYear(access.orgId, year, actualsFilter(ctx)),
      agentProfileRepository.getLifetimeProfit(ctx.subjectFilter),
      agentProfileRepository.listBiggestDeals(ctx.subjectFilter, 1),
      resolveComparator(ctx),
    ]);
    if (!subject) throw new AppError("Agent not found", 404);

    // A manager only sees a homeworker branch that is one of the memberships they may see.
    const homeworker =
      homeworkerBranch && (access.isAdmin || memberships.some((m) => m.branchId === homeworkerBranch.id))
        ? {
            branchId: homeworkerBranch.id,
            branchName: homeworkerBranch.name,
            isActive: homeworkerBranch.isActive,
            profitSharePercent:
              access.canSeePay && homeworkerBranch.profitSharePercent !== null
                ? Number(homeworkerBranch.profitSharePercent)
                : null,
          }
        : null;

    const started = resolveStartedAt(subject.hrStartDate, ctx.earliestJoinedAt, subject.createdAt);
    const best = pickBestMonth(toMonthSeries(actuals, year));
    const firstName = subject.firstName?.trim() || subject.name.split(" ")[0] || subject.name;

    return {
      user: {
        id: subject.id,
        name: subject.name,
        firstName,
        lastName: subject.lastName,
        email: subject.email,
        phone: subject.phone,
        image: subject.image,
      },
      organisationName: subject.organisationName ?? comparator.label,
      roles,
      primaryRole: primaryRole(roles),
      branches: memberships.map(toBranch),
      // Suspended = every membership the viewer can see is switched off (same switch the Teams page uses).
      isSuspended: memberships.length > 0 && memberships.every((m) => !m.isActive),
      isHomeworker: roles.includes("homeworker") || homeworker !== null,
      homeworker,
      startedAt: started.startedAt,
      startedAtSource: started.source,
      openDeals: openDeals.get(userId) ?? 0,
      biggestDeal: biggest[0] ? toDeal(biggest[0]) : null,
      bestMonth: best,
      lifetimeProfit,
      viewer: {
        isAdmin: access.isAdmin,
        canSeePay: access.canSeePay,
        comparatorScope: comparator.scope,
        comparatorLabel: comparator.label,
      },
    };
  },

  /** from/to are London dates, half-open [from, to). */
  async getPerformance(scope: Scope, userId: string, from: string, to: string): Promise<AgentProfilePerformance> {
    const ctx = await loadSubjectContext(scope, userId);
    const window: TimeWindow = { from: londonMidnight(from), to: londonMidnight(to) };

    const [own, quotes, quoteViews, other, comparator] = await Promise.all([
      agentProfileRepository.getWindowTotals(ctx.subjectFilter, window),
      agentProfileRepository.getQuoteWindowCounts(ctx.subjectFilter, window),
      agentProfileRepository.countQuoteViews(ctx.subjectFilter, window),
      agentProfileRepository.getWindowTotals(ctx.comparatorFilter, window),
      resolveComparator(ctx),
    ]);

    return {
      window: { from, to },
      profit: own.profit,
      bookings: own.bookings,
      sales: own.sales,
      ppb: perBooking(own.profit, own.bookings),
      quotesSent: quotes.quotesSent,
      quotedDeals: quotes.quotedDeals,
      quoteViews,
      closeRate: closeRatePercent(own.bookings, quotes.quotedDeals),
      commissionRate: commissionRate(own.profit, own.sales),
      comparator: {
        ...comparator,
        profit: other.profit,
        bookings: other.bookings,
        sales: other.sales,
        avgCommissionRate: commissionRate(other.profit, other.sales),
      },
    };
  },

  async getMonthly(scope: Scope, userId: string, year?: number, now: Date = new Date()): Promise<AgentProfileMonthly> {
    const ctx = await loadSubjectContext(scope, userId);
    const useYear = year ?? ukYearMonth(now).year;
    // Same actuals the targets pages use: the org comparator for admins, the manager's branch otherwise.
    const comparatorActuals = ctx.access.branchId ? { branchIds: [ctx.access.branchId] } : {};

    const [own, other, targets, comparator] = await Promise.all([
      targetsRepository.getActualsForYear(ctx.access.orgId, useYear, actualsFilter(ctx)),
      targetsRepository.getActualsForYear(ctx.access.orgId, useYear, comparatorActuals),
      getMemberYearTargets(scope, userId, useYear),
      resolveComparator(ctx),
    ]);

    return {
      year: useYear,
      currentMonth: yearProgress(useYear, now).currentMonth,
      months: toMonthSeries(own, useYear),
      comparator: { ...comparator, months: toMonthSeries(other, useYear) },
      targets,
    };
  },

  async getBiggestDeals(scope: Scope, userId: string, limit: number = DEFAULT_DEAL_LIMIT): Promise<{ rows: AgentProfileDeal[] }> {
    const ctx = await loadSubjectContext(scope, userId);
    const rows = await agentProfileRepository.listBiggestDeals(ctx.subjectFilter, limit);
    return { rows: rows.map(toDeal) };
  },
};

import * as targetsRepository from "./targets.repository";
import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";
import type {
  ShopTargetInput,
  AgentTargetInput,
  TargetsOverview,
  MonthTargetSummary,
} from "./targets.types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Agent targets within £500 of the shop target count as balanced.
const BALANCE_THRESHOLD = 500;

/**
 * Resolve which branch the request operates on.
 *
 * - branch_manager / agent / homeworker: always their own branch (scope.branchId).
 *   `override` is ignored.
 * - org_admin: defaults to scope.branchId if set, otherwise must pass `override`.
 *   The override branch must belong to their org.
 * - platform_admin: must pass `override` (no implicit branch).
 *
 * Returns the resolved branchId or throws AppError(400) if unresolved.
 */
async function resolveBranchId(scope: Scope, override?: string): Promise<string> {
  if (scope.orgRole === "platform_admin") {
    if (!override) throw new AppError("branchId is required for platform_admin", 400);
    return override;
  }

  if (scope.branchId && (!override || override === scope.branchId)) {
    return scope.branchId;
  }

  if (scope.orgRole === "org_admin" && override) {
    const ok = await targetsRepository.branchBelongsToOrg(override, scope.orgId);
    if (!ok) throw new AppError("Branch not found", 404);
    return override;
  }

  // Branch users cannot operate on a branch other than their own.
  if (override && scope.branchId && override !== scope.branchId) {
    throw new AppError("Branch not found", 404);
  }

  throw new AppError("Branch context required", 400);
}

async function assertAgentInBranch(userId: string, branchId: string) {
  const ok = await targetsRepository.userBelongsToBranch(userId, branchId);
  if (!ok) throw new AppError("Agent not found in this branch", 404);
}

function validateMonth(month: number) {
  if (month < 1 || month > 12) throw new AppError(`Invalid month: ${month}. Must be between 1 and 12.`, 400);
}
function validateYear(year: number) {
  if (year < 2020 || year > 2050) throw new AppError(`Invalid year: ${year}. Must be between 2020 and 2050.`, 400);
}
function validateAmount(amount: string) {
  const n = parseFloat(amount);
  if (isNaN(n) || n < 0) throw new AppError(`Invalid target amount: ${amount}. Must be a positive number.`, 400);
}

export async function getAllShopTargets(scope: Scope, branchOverride?: string) {
  const branchId = await resolveBranchId(scope, branchOverride);
  return targetsRepository.getAllShopTargets(branchId);
}

export async function upsertShopTargets(scope: Scope, targets: ShopTargetInput[], branchOverride?: string) {
  const branchId = await resolveBranchId(scope, branchOverride);
  for (const t of targets) {
    validateMonth(t.month);
    validateYear(t.year);
    validateAmount(t.targetAmount);
  }
  return targetsRepository.bulkUpsertShopTargets(branchId, targets);
}

export async function getAllAgentTargets(scope: Scope, branchOverride?: string) {
  const branchId = await resolveBranchId(scope, branchOverride);
  return targetsRepository.getAllAgentTargets(branchId);
}

export async function getAgentTargetsByUserId(scope: Scope, userId: string, branchOverride?: string) {
  const branchId = await resolveBranchId(scope, branchOverride);
  await assertAgentInBranch(userId, branchId);
  return targetsRepository.getAgentTargetsByUserId(branchId, userId);
}

export async function upsertAgentTargets(scope: Scope, targets: AgentTargetInput[], branchOverride?: string) {
  const branchId = await resolveBranchId(scope, branchOverride);

  const uniqueUserIds = new Set<string>();
  for (const t of targets) {
    if (!t.userId) throw new AppError("User ID is required for agent targets.", 400);
    validateMonth(t.month);
    validateYear(t.year);
    validateAmount(t.targetAmount);
    uniqueUserIds.add(t.userId);
  }

  const userIdList = Array.from(uniqueUserIds);
  const validMembers = await targetsRepository.getActiveBranchMemberIds(branchId, userIdList);
  for (const userId of userIdList) {
    if (!validMembers.has(userId)) throw new AppError("Agent not found in this branch", 404);
  }

  return targetsRepository.bulkUpsertAgentTargets(branchId, targets);
}

export async function getAllAgents(scope: Scope, branchOverride?: string) {
  const branchId = await resolveBranchId(scope, branchOverride);
  return targetsRepository.getAllAgents(branchId);
}

export async function getTargetsOverview(scope: Scope, branchOverride?: string): Promise<TargetsOverview> {
  const branchId = await resolveBranchId(scope, branchOverride);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  let endYear = currentYear;
  let endMonth = currentMonth + 23;

  if (endMonth > 12) {
    endYear += Math.floor(endMonth / 12);
    endMonth = endMonth % 12;
    if (endMonth === 0) {
      endMonth = 12;
      endYear -= 1;
    }
  }

  // Fetch from January of the current year (not the current month) so the
  // client's calendar-year overview can show figures for months already past.
  const [shopTargets, agentTargets, agents, summaryData] = await Promise.all([
    targetsRepository.getShopTargetsByDateRange(branchId, currentYear, 1, endYear, endMonth),
    targetsRepository.getAgentTargetsByDateRange(branchId, currentYear, 1, endYear, endMonth),
    targetsRepository.getAllAgents(branchId),
    targetsRepository.getTargetSummaryByDateRange(branchId, currentYear, 1, endYear, endMonth),
  ]);

  const summary: MonthTargetSummary[] = [];

  const agentSumMap = new Map<string, string>();
  for (const sum of summaryData.agentTargetSums) {
    const key = `${sum.year}-${sum.month}`;
    agentSumMap.set(key, sum.total);
  }

  const shopTargetMap = new Map<string, string>();
  for (const target of summaryData.shopTargets) {
    const key = `${target.year}-${target.month}`;
    shopTargetMap.set(key, target.targetAmount);
  }

  // The summary is calendar-anchored: it starts at January of the current year
  // (so the client's year overview can show months already past) and runs
  // through the end of the 24-month fetch window.
  const totalMonths = (endYear - currentYear) * 12 + endMonth;
  for (let i = 0; i < totalMonths; i++) {
    const year = currentYear + Math.floor(i / 12);
    const month = (i % 12) + 1;

    const key = `${year}-${month}`;
    const shopTarget = shopTargetMap.get(key) || "0.00";
    const totalAgentTargets = agentSumMap.get(key) || "0.00";

    const shopAmount = parseFloat(shopTarget);
    const agentAmount = parseFloat(totalAgentTargets);
    const diff = agentAmount - shopAmount;

    summary.push({
      year,
      month,
      monthName: MONTH_NAMES[month - 1],
      shopTarget,
      totalAgentTargets,
      difference: diff.toFixed(2),
      status: Math.abs(diff) < BALANCE_THRESHOLD ? "balanced" : diff > 0 ? "over" : "under",
    });
  }

  return {
    branchId,
    shopTargets,
    agentTargets,
    agents,
    summary,
  };
}

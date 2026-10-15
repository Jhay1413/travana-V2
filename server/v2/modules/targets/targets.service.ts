import * as targetsRepository from "./targets.repository";
import { AppError } from "../../utils/error-handler";
import { holdsHomeworkerRole, type Scope } from "../../utils/scope";
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

interface BranchContext {
  branchId: string;
  isHomeworker: boolean;
  ownerUserId: string | null;
  /** Homeworker branch with a recorded owner. The legacy shared branch (no owner) is not owner-scoped. */
  ownerScoped: boolean;
}

// Homeworker branches carry only the owner's agent target, never a shop target.
async function resolveBranch(scope: Scope, override?: string): Promise<BranchContext> {
  const branchId = await resolveBranchId(scope, override);
  const info = await targetsRepository.getBranchInfo(branchId);
  return {
    branchId,
    isHomeworker: info?.branchType === "homeworker",
    ownerUserId: info?.ownerUserId ?? null,
    ownerScoped: info?.branchType === "homeworker" && !!info.ownerUserId,
  };
}

async function assertAgentInBranch(userId: string, branchId: string) {
  const ok = await targetsRepository.userBelongsToBranch(userId, branchId);
  if (!ok) throw new AppError("Agent not found in this branch", 404);
}

// Agents and homeworkers may only read their own per-agent targets.
function isSelfOnlyRole(scope: Scope): boolean {
  return scope.orgRole === "agent" || holdsHomeworkerRole(scope);
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
  const branch = await resolveBranch(scope, branchOverride);
  if (branch.isHomeworker) return [];
  return targetsRepository.getAllShopTargets(branch.branchId);
}

export async function upsertShopTargets(scope: Scope, targets: ShopTargetInput[], branchOverride?: string) {
  const branch = await resolveBranch(scope, branchOverride);
  if (branch.isHomeworker) throw new AppError("Homeworker branches do not have shop targets", 400);
  for (const t of targets) {
    validateMonth(t.month);
    validateYear(t.year);
    validateAmount(t.targetAmount);
  }
  return targetsRepository.bulkUpsertShopTargets(branch.branchId, targets);
}

export async function getAllAgentTargets(scope: Scope, branchOverride?: string) {
  const branch = await resolveBranch(scope, branchOverride);
  if (isSelfOnlyRole(scope)) {
    if (!scope.userId) throw new AppError("Forbidden", 403);
    return targetsRepository.getAgentTargetsByUserId(branch.branchId, scope.userId);
  }
  if (branch.ownerScoped && branch.ownerUserId) {
    return targetsRepository.getAgentTargetsByUserId(branch.branchId, branch.ownerUserId);
  }
  return targetsRepository.getAllAgentTargets(branch.branchId);
}

export async function getAgentTargetsByUserId(scope: Scope, userId: string, branchOverride?: string) {
  if (isSelfOnlyRole(scope) && userId !== scope.userId) {
    throw new AppError("You can only view your own targets", 403);
  }
  const branchId = await resolveBranchId(scope, branchOverride);
  await assertAgentInBranch(userId, branchId);
  return targetsRepository.getAgentTargetsByUserId(branchId, userId);
}

export async function upsertAgentTargets(scope: Scope, targets: AgentTargetInput[], branchOverride?: string) {
  const branch = await resolveBranch(scope, branchOverride);
  const branchId = branch.branchId;

  const uniqueUserIds = new Set<string>();
  for (const t of targets) {
    if (!t.userId) throw new AppError("User ID is required for agent targets.", 400);
    if (branch.ownerScoped && t.userId !== branch.ownerUserId) {
      throw new AppError("Homeworker branches only carry the owner's target", 400);
    }
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
  const branch = await resolveBranch(scope, branchOverride);
  const allAgents = await targetsRepository.getAllAgents(branch.branchId);
  const agents = branch.ownerScoped ? allAgents.filter((a) => a.id === branch.ownerUserId) : allAgents;
  return isSelfOnlyRole(scope) ? agents.filter((a) => a.id === scope.userId) : agents;
}

export async function getTargetsOverview(scope: Scope, branchOverride?: string): Promise<TargetsOverview> {
  const branch = await resolveBranch(scope, branchOverride);
  const branchId = branch.branchId;

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
  const [fetchedShopTargets, fetchedAgentTargets, fetchedAgents, fetchedSummary] = await Promise.all([
    branch.isHomeworker
      ? Promise.resolve([])
      : targetsRepository.getShopTargetsByDateRange(branchId, currentYear, 1, endYear, endMonth),
    targetsRepository.getAgentTargetsByDateRange(branchId, currentYear, 1, endYear, endMonth),
    targetsRepository.getAllAgents(branchId),
    targetsRepository.getTargetSummaryByDateRange(branchId, currentYear, 1, endYear, endMonth, !branch.isHomeworker),
  ]);

  // A homeworker branch has no shop target and only its owner as an agent.
  const shopTargets = branch.isHomeworker ? [] : fetchedShopTargets;
  const summaryData = branch.isHomeworker ? { ...fetchedSummary, shopTargets: [] } : fetchedSummary;
  const allAgentTargets = branch.ownerScoped
    ? fetchedAgentTargets.filter((t) => t.userId === branch.ownerUserId)
    : fetchedAgentTargets;
  const allAgents = branch.ownerScoped ? fetchedAgents.filter((a) => a.id === branch.ownerUserId) : fetchedAgents;

  const selfOnly = isSelfOnlyRole(scope);
  const agentTargets = selfOnly ? allAgentTargets.filter((t) => t.userId === scope.userId) : allAgentTargets;
  const agents = selfOnly ? allAgents.filter((a) => a.id === scope.userId) : allAgents;

  const summary: MonthTargetSummary[] = [];

  const agentSumMap = new Map<string, string>();
  if (selfOnly || branch.ownerScoped) {
    // Org-wide per-month totals would leak colleagues' targets; sum only the caller's own.
    for (const t of agentTargets) {
      const key = `${t.year}-${t.month}`;
      agentSumMap.set(key, (parseFloat(agentSumMap.get(key) ?? "0") + parseFloat(t.targetAmount)).toFixed(2));
    }
  } else {
    for (const sum of summaryData.agentTargetSums) {
      const key = `${sum.year}-${sum.month}`;
      agentSumMap.set(key, sum.total);
    }
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

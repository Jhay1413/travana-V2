import * as targetsRepository from "./targets.repository";
import { AppError } from "../../utils/error-handler";
import { holdsHomeworkerRole, type Scope } from "../../utils/scope";
import { organizationAuditService, type OrgAuditAction } from "../organization/organization-audit.service";
import type { RequestActor } from "../../utils/request-actor";
import { ukYearMonth, ukStartOfYear, ukStartOfNextYear } from "../../utils/london-dates";
import type {
  ShopTargetInput,
  AgentTargetInput,
  TargetsOverview,
  MonthTargetSummary,
  TargetsYear,
  YearAgentRow,
  YearHomeworkerRow,
  YearBranchRow,
  YearCanEdit,
  AgentTargetRowData,
  AgentTargetRowWrite,
  ActualRow,
  BranchRecord,
  AllocationInput,
  MonthsInput,
  OverrideInput,
  MonthAmounts,
} from "./targets.types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

async function audit(
  actor: RequestActor | undefined,
  action: OrgAuditAction,
  orgId: string,
  metadata: Record<string, unknown>,
  targetUserId?: string,
): Promise<void> {
  if (!actor) return;
  await organizationAuditService.record({ actor, action, orgId, targetUserId, metadata });
}

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
  if (year < 2000 || year > 2100) throw new AppError(`Invalid year: ${year}. Must be between 2000 and 2100.`, 400);
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

export async function upsertShopTargets(
  scope: Scope,
  targets: ShopTargetInput[],
  branchOverride?: string,
  actor?: RequestActor,
) {
  const branch = await resolveBranch(scope, branchOverride);
  if (branch.isHomeworker) throw new AppError("Homeworker branches do not have shop targets", 400);
  for (const t of targets) {
    validateMonth(t.month);
    validateYear(t.year);
    validateAmount(t.targetAmount);
  }
  const saved = await targetsRepository.bulkUpsertShopTargets(branch.branchId, targets);
  await audit(actor, "targets.shop.set", scope.orgId, { branchId: branch.branchId, months: targets.length });
  return saved;
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

export async function upsertAgentTargets(
  scope: Scope,
  targets: AgentTargetInput[],
  branchOverride?: string,
  actor?: RequestActor,
) {
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

  if (branch.ownerScoped && branch.ownerUserId) {
    // A homeworker branch target set here is an admin override: route it through the same
    // bookkeeping (source 'admin', self_amount kept, updated_by) so it never looks like the owner's own figure.
    const ownerId = branch.ownerUserId;
    const actorId = actor?.userId ?? scope.userId ?? null;
    await targetsRepository.withTransaction(async (tx) => {
      const years = Array.from(new Set(targets.map((t) => t.year)));
      for (const year of years) {
        const existing = await targetsRepository.getAgentTargetRowsForYear([branchId], year, ownerId, tx, true);
        const entries = targets
          .filter((t) => t.year === year)
          .map((t) => ({ month: t.month, value: Math.round(parseFloat(t.targetAmount)) }));
        await targetsRepository.upsertAgentTargetRows(
          tx,
          applyOverride(branchId, ownerId, actorId, year, entries, null, existing),
        );
      }
    });
    await audit(actor, "targets.homeworker.override", scope.orgId, { branchId, months: targets.length }, ownerId);
    return targetsRepository.getAgentTargetsByUserId(branchId, ownerId);
  }

  const saved = await targetsRepository.bulkUpsertAgentTargets(branchId, targets);
  await audit(actor, "targets.agent.set", scope.orgId, { branchId, userIds: userIdList, months: targets.length });
  return saved;
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

  // London calendar, not the server-local clock.
  const { year: currentYear, month: currentMonth } = ukYearMonth(new Date());

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
      // Exact whole pounds: any difference at all is over/under.
      status: Math.round(diff) === 0 ? "balanced" : diff > 0 ? "over" : "under",
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

// ─── Year view and redesign writes ───────────────────────────────────────

const MONTHS_IN_YEAR = 12;

function zeroMonths(): MonthAmounts {
  return new Array<number>(MONTHS_IN_YEAR).fill(0);
}

function wholePounds(value: string | number): number {
  return Math.round(Number(value));
}

function isAdminRole(scope: Scope): boolean {
  return scope.orgRole === "org_admin" || scope.orgRole === "platform_admin";
}

// A platform_admin has no home organisation; they must be acting inside one.
function requireOrgId(scope: Scope): string {
  if (!scope.orgId) throw new AppError("Organisation context required", 400);
  return scope.orgId;
}

/**
 * Elapsed share of the year and the "current" month, both on the London calendar.
 * Past year: elapsed 1, currentMonth 12. Future year: elapsed 0, currentMonth 0.
 */
export function yearProgress(year: number, now: Date): { elapsed: number; currentMonth: number } {
  const { year: nowYear, month: nowMonth } = ukYearMonth(now);
  if (year < nowYear) return { elapsed: 1, currentMonth: MONTHS_IN_YEAR };
  if (year > nowYear) return { elapsed: 0, currentMonth: 0 };
  const start = ukStartOfYear(now).getTime();
  const end = ukStartOfNextYear(now).getTime();
  const elapsed = Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
  return { elapsed, currentMonth: nowMonth };
}

function monthsFromRows(rows: { month: number; amount: string }[]): MonthAmounts {
  const months = zeroMonths();
  for (const r of rows) {
    if (r.month >= 1 && r.month <= MONTHS_IN_YEAR) months[r.month - 1] = wholePounds(r.amount);
  }
  return months;
}

function actualMonths(rows: ActualRow[]): MonthAmounts {
  const months = zeroMonths();
  for (const r of rows) {
    if (r.month >= 1 && r.month <= MONTHS_IN_YEAR) months[r.month - 1] += r.amount;
  }
  return months.map((m) => Math.round(m));
}

/**
 * Legacy homeworker rows (default source 'admin', never written by the new flows so updated_by is null)
 * are the homeworker's OWN figure: read them as source 'self' with self_amount = target_amount.
 * Only used for rows on homeworker branches.
 */
function normalizeHomeworkerRow(r: AgentTargetRowData): AgentTargetRowData {
  if (r.source === "admin" && r.updatedBy === null) {
    return { ...r, source: "self", selfAmount: r.selfAmount ?? r.targetAmount };
  }
  return r;
}

function isBetterNote(candidate: AgentTargetRowData, current: AgentTargetRowData | null): boolean {
  if (!current) return true;
  const c = candidate.updatedAt?.getTime() ?? 0;
  const k = current.updatedAt?.getTime() ?? 0;
  return c > k || (c === k && candidate.month < current.month);
}

function buildHomeworkerRow(
  branch: { id: string; name: string; ownerUserId: string; ownerName: string | null },
  rows: AgentTargetRowData[],
  actual: MonthAmounts,
): YearHomeworkerRow {
  const months = zeroMonths();
  const selfMonths: (number | null)[] = new Array<number | null>(MONTHS_IN_YEAR).fill(null);
  let source: "self" | "admin" = "self";
  // Deterministic note: the most recently updated override note, else the lowest month's.
  let noteRow: AgentTargetRowData | null = null;
  for (const raw of rows) {
    if (raw.branchId !== branch.id || raw.userId !== branch.ownerUserId) continue;
    const r = normalizeHomeworkerRow(raw);
    const i = r.month - 1;
    months[i] = wholePounds(r.targetAmount);
    selfMonths[i] = r.selfAmount !== null ? wholePounds(r.selfAmount) : r.source === "self" ? months[i] : null;
    if (r.source === "admin") {
      source = "admin";
      if (r.note !== null && isBetterNote(r, noteRow)) noteRow = r;
    }
  }
  const note = noteRow?.note ?? null;
  return {
    userId: branch.ownerUserId,
    branchId: branch.id,
    name: branch.ownerName ?? branch.name,
    months,
    selfMonths,
    source,
    note,
    actual,
  };
}

interface TargetBranchSelection {
  admin: boolean;
  manager: boolean;
  selfUserId: string | undefined;
  /** Every active shop in the org (what an admin can edit). */
  shops: BranchRecord[];
  visibleShops: BranchRecord[];
  /** Shop branches whose agents the viewer can see. */
  agentBranches: BranchRecord[];
  visibleHomeworkers: BranchRecord[];
}

/**
 * Which branches a viewer sees on the targets pages: admins all active shops and homeworker
 * branches; a branch manager their own shop; anyone else only themselves. One definition,
 * shared by the whole-year view and getMemberYearTargets.
 */
async function selectTargetBranches(scope: Scope, orgId: string): Promise<TargetBranchSelection> {
  const admin = isAdminRole(scope);
  const manager = !admin && scope.orgRole === "branch_manager";
  // Self-only scope must know who "self" is; never fall back to an unfiltered query.
  if (!admin && !manager && !scope.userId) throw new AppError("Forbidden", 403);
  const selfUserId = admin || manager ? undefined : (scope.userId as string);

  // Validated above, before any query: a self-only caller without an id never reaches the database.
  const allBranches = await targetsRepository.listBranchesByOrg(orgId);
  const shops = allBranches.filter((b) => b.branchType === "shop" && b.isActive);
  const homeworkerBranches = allBranches.filter((b) => b.branchType === "homeworker" && b.ownerUserId);

  let visibleShops = shops;
  let agentBranches = shops;
  let visibleHomeworkers = homeworkerBranches;
  if (manager) {
    if (!scope.branchId) throw new AppError("Branch context required", 400);
    visibleShops = shops.filter((b) => b.id === scope.branchId);
    agentBranches = visibleShops;
    visibleHomeworkers = [];
  } else if (!admin) {
    visibleShops = [];
    visibleHomeworkers = homeworkerBranches.filter((b) => b.ownerUserId === selfUserId);
  }
  return { admin, manager, selfUserId, shops, visibleShops, agentBranches, visibleHomeworkers };
}

/**
 * One member's monthly targets for a year: the sum of their agent-target rows over the branches the
 * viewer can see (a shop agent: their shop rows; a homeworker: their own branch). Whole pounds.
 */
export async function getMemberYearTargets(scope: Scope, userId: string, year: number): Promise<MonthAmounts> {
  const orgId = requireOrgId(scope);
  const { agentBranches, visibleHomeworkers } = await selectTargetBranches(scope, orgId);
  const branchIds = [...agentBranches, ...visibleHomeworkers].map((b) => b.id);
  const [rows, members] = await Promise.all([
    targetsRepository.getAgentTargetRowsForYear(branchIds, year, userId),
    // Only rows in branches the user currently belongs to (a removed membership no longer counts).
    targetsRepository.listMembers(orgId, agentBranches.map((b) => b.id), userId),
  ]);
  const memberBranches = new Set(members.map((m) => m.branchId));
  const months = zeroMonths();
  for (const r of rows) {
    const isOwnHomeworkerBranch = visibleHomeworkers.some((b) => b.id === r.branchId && b.ownerUserId === userId);
    if (!memberBranches.has(r.branchId) && !isOwnHomeworkerBranch) continue;
    if (r.month >= 1 && r.month <= MONTHS_IN_YEAR) months[r.month - 1] += wholePounds(r.targetAmount);
  }
  return months;
}

/**
 * Whole-year targets and actuals, scoped by role:
 * - org_admin / platform_admin (org required): business, every active shop, every shop agent, every homeworker.
 * - branch_manager: their own shop and its agents only (no business, no homeworkers).
 * - agent / homeworker / others: self only. `branches` is [] (shop targets are not shared with agents);
 *   a homeworker sees only their own homeworker row; `business` is null.
 */
export async function getTargetsYear(scope: Scope, year: number, now: Date = new Date()): Promise<TargetsYear> {
  const orgId = requireOrgId(scope);
  const { elapsed, currentMonth } = yearProgress(year, now);
  const { admin, manager, selfUserId, shops, visibleShops, agentBranches, visibleHomeworkers } = await selectTargetBranches(scope, orgId);

  const agentBranchIds = agentBranches.map((b) => b.id);
  const targetBranchIds = [...agentBranchIds, ...visibleHomeworkers.map((b) => b.id)];
  const actualsFilter = admin ? {} : manager ? { branchIds: agentBranchIds } : { userId: selfUserId };

  const [orgRows, shopRows, agentRows, members, actuals] = await Promise.all([
    admin ? targetsRepository.getOrgTargetsForYear(orgId, year) : Promise.resolve([]),
    targetsRepository.getShopTargetsForYear(visibleShops.map((b) => b.id), year),
    targetsRepository.getAgentTargetRowsForYear(targetBranchIds, year, selfUserId),
    targetsRepository.listMembers(orgId, agentBranchIds, selfUserId),
    targetsRepository.getActualsForYear(orgId, year, actualsFilter),
  ]);
  // A homeworker's branch actual uses the same definition admins see: gross commission of the whole branch.
  const homeworkerBranchIds = visibleHomeworkers.map((b) => b.id);
  const homeworkerActuals =
    admin || homeworkerBranchIds.length === 0
      ? actuals
      : await targetsRepository.getActualsForYear(orgId, year, { branchIds: homeworkerBranchIds });

  const business = admin ? { months: monthsFromRows(orgRows), actual: actualMonths(actuals) } : null;

  const branchRows: YearBranchRow[] = visibleShops.map((b) => ({
    id: b.id,
    name: b.name,
    months: monthsFromRows(shopRows.filter((r) => r.branchId === b.id)),
    actual: actualMonths(actuals.filter((a) => a.branchId === b.id)),
  }));

  const agents: YearAgentRow[] = [];
  for (const m of members) {
    const months = monthsFromRows(
      agentRows
        .filter((r) => r.branchId === m.branchId && r.userId === m.userId)
        .map((r) => ({ month: r.month, amount: r.targetAmount })),
    );
    // A deactivated member only shows while they still carry a target this year.
    if (!m.isActive && !months.some((v) => v > 0)) continue;
    agents.push({
      userId: m.userId,
      name: m.name,
      branchId: m.branchId,
      months,
      actual: actualMonths(actuals.filter((a) => a.branchId === m.branchId && a.userId === m.userId)),
      ...(m.isActive ? {} : { inactive: true as const }),
    });
  }

  const homeworkers = visibleHomeworkers.map((b) =>
    buildHomeworkerRow(
      { id: b.id, name: b.name, ownerUserId: b.ownerUserId ?? "", ownerName: b.ownerName },
      agentRows,
      actualMonths(homeworkerActuals.filter((a) => a.branchId === b.id)),
    ),
  );

  const canEdit: YearCanEdit = {
    business: admin,
    shopBranchIds: admin ? shops.map((b) => b.id) : [],
    agentBranchIds: admin || manager ? agentBranchIds : [],
    homeworkers: admin,
    mine: !admin && !manager && holdsHomeworkerRole(scope) && homeworkers.length > 0,
  };

  return { year, elapsed, currentMonth, business, branches: branchRows, agents, homeworkers, canEdit };
}

export async function setBusinessTargets(scope: Scope, actor: RequestActor, input: MonthsInput): Promise<TargetsYear> {
  if (!isAdminRole(scope)) throw new AppError("Only an organisation admin can set the business target", 403);
  const orgId = requireOrgId(scope);
  await targetsRepository.withTransaction((tx) => targetsRepository.upsertOrgTargets(tx, orgId, input.year, input.months));
  await audit(actor, "targets.business.set", orgId, { year: input.year, months: input.months });
  return getTargetsYear(scope, input.year);
}

function monthEntries(months: MonthAmounts): { month: number; value: number }[] {
  return months.map((value, i) => ({ month: i + 1, value }));
}

function indexByMonth(rows: AgentTargetRowData[]): Map<number, AgentTargetRowData> {
  return new Map(rows.map((r) => [r.month, normalizeHomeworkerRow(r)] as const));
}

/**
 * A homeworker sets their own figure. While an admin override is in force for a
 * month, only the remembered self_amount changes (the effective target stays).
 */
function applySelfTargets(
  branchId: string,
  userId: string,
  year: number,
  months: MonthAmounts,
  existing: AgentTargetRowData[],
): AgentTargetRowWrite[] {
  const byMonth = indexByMonth(existing);
  const writes: AgentTargetRowWrite[] = [];
  months.forEach((value, i) => {
    const e = byMonth.get(i + 1);
    const base = { branchId, userId, year, month: i + 1, updatedBy: userId };
    if (!e) {
      if (value === 0) return;
      writes.push({ ...base, targetAmount: String(value), source: "self", selfAmount: String(value), note: null });
    } else if (e.source === "admin") {
      // The admin override stays in force and keeps its author; only the owner's own figure changes.
      writes.push({ ...base, updatedBy: e.updatedBy, targetAmount: e.targetAmount, source: "admin", selfAmount: String(value), note: e.note });
    } else {
      writes.push({ ...base, targetAmount: String(value), source: "self", selfAmount: String(value), note: null });
    }
  });
  return writes;
}

/**
 * An admin override sets the effective target and remembers the owner's own figure.
 * Months whose value already equals the effective target of a non-overridden row are
 * left alone, so only genuinely changed months are marked as overridden.
 */
function applyOverride(
  branchId: string,
  userId: string,
  actorId: string | null,
  year: number,
  entries: { month: number; value: number }[],
  note: string | null,
  existing: AgentTargetRowData[],
): AgentTargetRowWrite[] {
  const byMonth = indexByMonth(existing);
  const writes: AgentTargetRowWrite[] = [];
  entries.forEach(({ month, value }) => {
    const e = byMonth.get(month);
    if (!e && value === 0) return;
    // Same value on an owner-set (or legacy) row: not an override, leave it alone.
    if (e && e.source === "self" && wholePounds(e.targetAmount) === value) return;
    writes.push({
      branchId,
      userId,
      year,
      month,
      targetAmount: String(value),
      source: "admin",
      selfAmount: e?.selfAmount ?? null,
      note,
      updatedBy: actorId ?? userId,
    });
  });
  return writes;
}

export async function setMyTargets(scope: Scope, actor: RequestActor, input: MonthsInput): Promise<TargetsYear> {
  const orgId = requireOrgId(scope);
  if (!holdsHomeworkerRole(scope) || !scope.userId) {
    throw new AppError("Only a homeworker can set their own target", 403);
  }
  const userId = scope.userId;
  const branch = await targetsRepository.findHomeworkerBranchByOwner(orgId, userId);
  if (!branch) throw new AppError("You do not own a homeworker branch", 403);

  await targetsRepository.withTransaction(async (tx) => {
    const existing = await targetsRepository.getAgentTargetRowsForYear([branch.id], input.year, userId, tx, true);
    await targetsRepository.upsertAgentTargetRows(tx, applySelfTargets(branch.id, userId, input.year, input.months, existing));
  });
  await audit(actor, "targets.homeworker.self", orgId, { year: input.year, branchId: branch.id, months: input.months }, userId);
  return getTargetsYear(scope, input.year);
}

async function requireHomeworkerBranch(orgId: string, ownerUserId: string): Promise<{ id: string; name: string }> {
  const branch = await targetsRepository.findHomeworkerBranchByOwner(orgId, ownerUserId);
  if (!branch) throw new AppError("Homeworker not found", 404);
  return branch;
}

export async function setHomeworkerOverride(
  scope: Scope,
  actor: RequestActor,
  userId: string,
  input: OverrideInput,
): Promise<TargetsYear> {
  if (!isAdminRole(scope)) throw new AppError("Only an organisation admin can override a homeworker target", 403);
  const orgId = requireOrgId(scope);
  const branch = await requireHomeworkerBranch(orgId, userId);
  const note = input.note?.trim() ? input.note.trim() : null;

  await targetsRepository.withTransaction(async (tx) => {
    const existing = await targetsRepository.getAgentTargetRowsForYear([branch.id], input.year, userId, tx, true);
    await targetsRepository.upsertAgentTargetRows(
      tx,
      applyOverride(branch.id, userId, actor.userId, input.year, monthEntries(input.months), note, existing),
    );
  });
  await audit(actor, "targets.homeworker.override", orgId, { year: input.year, branchId: branch.id, months: input.months, note }, userId);
  return getTargetsYear(scope, input.year);
}

/** Drops an admin override: months go back to the owner's own figure (or are removed if they had none). */
export async function revertHomeworkerOverride(
  scope: Scope,
  actor: RequestActor,
  userId: string,
  year: number,
): Promise<TargetsYear> {
  if (!isAdminRole(scope)) throw new AppError("Only an organisation admin can revert a homeworker override", 403);
  const orgId = requireOrgId(scope);
  const branch = await requireHomeworkerBranch(orgId, userId);

  await targetsRepository.withTransaction(async (tx) => {
    const overridden = (await targetsRepository.getAgentTargetRowsForYear([branch.id], year, userId, tx, true))
      .map(normalizeHomeworkerRow)
      .filter((r) => r.source === "admin");
    const restore = overridden.filter((r) => r.selfAmount !== null);
    const remove = overridden.filter((r) => r.selfAmount === null);
    await targetsRepository.upsertAgentTargetRows(
      tx,
      restore.map((r) => ({
        branchId: branch.id,
        userId,
        year,
        month: r.month,
        targetAmount: r.selfAmount ?? "0",
        source: "self" as const,
        selfAmount: r.selfAmount,
        note: null,
        updatedBy: actor.userId,
      })),
    );
    await targetsRepository.deleteAgentTargetRows(tx, branch.id, userId, year, remove.map((r) => r.month));
  });
  await audit(actor, "targets.homeworker.revert", orgId, { year, branchId: branch.id }, userId);
  return getTargetsYear(scope, year);
}

function assertUnique<T>(items: T[], key: (item: T) => string, message: string) {
  const seen = new Set<string>();
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) throw new AppError(message, 400);
    seen.add(k);
  }
}

/**
 * Saves business, shop and agent targets in ONE transaction. Only the supplied rows are
 * written. A branch_manager may send `agents` for their own branch only.
 */
export async function saveAllocation(scope: Scope, actor: RequestActor, input: AllocationInput): Promise<TargetsYear> {
  const admin = isAdminRole(scope);
  const manager = !admin && scope.orgRole === "branch_manager";
  if (!admin && !manager) throw new AppError("You do not have permission to set targets", 403);

  const shops = input.shops ?? [];
  const agents = input.agents ?? [];
  if (manager) {
    if (input.business || shops.length > 0) {
      throw new AppError("Branch managers can only set agent targets for their own branch", 403);
    }
    if (!scope.branchId || agents.some((a) => a.branchId !== scope.branchId)) {
      throw new AppError("You can only set targets for your own branch", 403);
    }
  }
  const orgId = requireOrgId(scope);

  assertUnique(shops, (s) => s.branchId, "A shop appears more than once");
  assertUnique(agents, (a) => `${a.branchId}|${a.userId}`, "An agent appears more than once for the same branch");

  const branchIds = Array.from(new Set([...shops.map((s) => s.branchId), ...agents.map((a) => a.branchId)]));
  const found = new Map((await targetsRepository.getOrgBranchesByIds(orgId, branchIds)).map((b) => [b.id, b.branchType] as const));
  for (const id of branchIds) {
    const type = found.get(id);
    if (!type) throw new AppError("Branch not found", 404);
    if (type !== "shop") throw new AppError("Homeworker targets are set through the homeworker override", 400);
  }

  const idsByBranch = new Map<string, string[]>();
  for (const a of agents) idsByBranch.set(a.branchId, [...(idsByBranch.get(a.branchId) ?? []), a.userId]);
  for (const [branchId, userIds] of Array.from(idsByBranch.entries())) {
    const members = await targetsRepository.getMemberUserIds(branchId, userIds);
    if (userIds.some((id) => !members.has(id))) throw new AppError("Agent not found in this branch", 404);
  }

  await targetsRepository.withTransaction(async (tx) => {
    if (input.business) await targetsRepository.upsertOrgTargets(tx, orgId, input.year, input.business.months);
    for (const s of shops) await targetsRepository.upsertShopTargetMonths(tx, s.branchId, input.year, s.months);
    for (const a of agents) {
      await targetsRepository.upsertAgentTargetMonths(tx, a.branchId, a.userId, input.year, a.months, actor.userId);
    }
  });

  if (input.business) await audit(actor, "targets.business.set", orgId, { year: input.year, months: input.business.months });
  if (shops.length > 0) await audit(actor, "targets.shop.set", orgId, { year: input.year, branchIds: shops.map((s) => s.branchId) });
  if (agents.length > 0) {
    await audit(actor, "targets.agent.set", orgId, {
      year: input.year,
      agents: agents.map((a) => ({ branchId: a.branchId, userId: a.userId })),
    });
  }
  return getTargetsYear(scope, input.year);
}

import { and, eq, isNull, or, sql, SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { transaction, clientTable, branches, branchMembers } from "@shared/schema";
import { holdsHomeworkerRole, type Scope } from "./scope";

export interface ScopeFilter {
  orgId: string | null;
  branchId: string | null;
  /** Caller's full scope; when present the shop/homeworker partition is layered on. */
  partitionScope?: Scope;
}

export type ScopeOrTrusted = Scope | { orgId: null };

export interface PartitionOptions {
  /**
   * TRANSITIONAL. For a homeworker with an owner condition, also allow rows whose
   * branch is still NULL (legacy rows) when they are the caller's own. Remove once
   * the Phase 8 migration has backfilled branch_id.
   */
  allowNullBranchForOwner?: boolean;
}

/**
 * The shop <-> homeworker partition layer. ONE helper, used by every repository
 * that reads tenant data, so isolation cannot drift between modules.
 *
 * `ownerCol` is either a column (matched with `= scope.userId`) or a ready-made
 * SQL "this row is mine" condition (e.g. tickets: creator OR assignee).
 *
 *  - trusted scope ({ orgId: null }), platform_admin, org_admin -> undefined (no restriction)
 *  - homeworker inside their OWN homeworker branch -> branchCol = own branch,
 *    AND owner condition when ownerCol is given
 *  - homeworker NOT in their own branch (legacy shared/shop branch) -> per-user
 *    rule (owner condition); without an ownerCol, fall back to branchCol = own branch
 *  - every other role -> branchCol IS NULL OR branchCol NOT IN the org's homeworker
 *    branches. The IS NULL arm keeps legacy rows with no branch visible.
 *
 * Returns undefined when no restriction applies; callers add it only if defined.
 * Existing role narrowing (branch pinning, created_by) stays in the callers.
 */
export function buildPartitionCond(
  scope: ScopeOrTrusted,
  branchCol: AnyPgColumn | SQL,
  ownerCol?: AnyPgColumn | SQL,
  opts?: PartitionOptions,
): SQL | undefined {
  if (scope.orgId === null) return undefined; // trusted internal caller
  const s = scope as Scope;
  if (s.orgRole === "platform_admin" || s.orgRole === "org_admin") return undefined;

  if (holdsHomeworkerRole(s)) {
    // Fail closed when a column owner is requested but the caller has no user id.
    const owner: SQL | undefined = !ownerCol
      ? undefined
      : ownerCol instanceof SQL
        ? ownerCol
        : s.userId
          ? eq(ownerCol, s.userId)
          : sql`false`;

    let base: SQL | undefined;
    if (s.ownsHomeworkerBranch && s.branchId) {
      base = owner ? and(eq(branchCol as AnyPgColumn, s.branchId), owner) : eq(branchCol as AnyPgColumn, s.branchId);
    } else if (owner) {
      base = owner;
    } else {
      base = s.branchId ? eq(branchCol as AnyPgColumn, s.branchId) : sql`false`;
    }
    if (opts?.allowNullBranchForOwner && owner && base) {
      return or(base, and(isNull(branchCol as AnyPgColumn), owner));
    }
    return base;
  }

  return or(
    isNull(branchCol as AnyPgColumn),
    sql`${branchCol} NOT IN (SELECT ${branches.id} FROM ${branches} WHERE ${branches.organizationId} = ${s.orgId} AND ${branches.branchType} = 'homeworker')`,
  );
}

/**
 * Partition layer for USER listings (agent pickers, rosters), where the row is a
 * user rather than a record with a branch column.
 *
 *  - trusted scope, platform_admin, org_admin -> undefined
 *  - homeworker (any held role) -> only themselves (fail closed without a userId)
 *  - everyone else -> users with no active membership in a homeworker branch of the org
 */
export function buildUserPartitionCond(
  scope: ScopeOrTrusted,
  userIdCol: AnyPgColumn | SQL,
): SQL | undefined {
  if (scope.orgId === null) return undefined;
  const s = scope as Scope;
  if (s.orgRole === "platform_admin" || s.orgRole === "org_admin") return undefined;

  if (holdsHomeworkerRole(s)) {
    return s.userId ? eq(userIdCol as AnyPgColumn, s.userId) : sql`false`;
  }

  return sql`${userIdCol} NOT IN (SELECT ${branchMembers.userId} FROM ${branchMembers} INNER JOIN ${branches} ON ${branches.id} = ${branchMembers.branchId} WHERE ${branches.organizationId} = ${s.orgId} AND ${branches.branchType} = 'homeworker' AND ${branchMembers.isActive} = true)`;
}

/**
 * Role-aware per-request data-scope conditions on the `transaction` table.
 *
 * Mirrors the canonical pattern (buildOpportunityScopeConds / buildTxnScopeConds):
 *  - trusted internal caller ({ orgId: null }) or platform_admin → no restriction
 *  - every other role → confined to their org (transaction.org_id)
 *  - branch_manager / agent (with a branchId) → also confined to their branch
 *  - the shop/homeworker partition is layered on via buildPartitionCond (homeworkers
 *    see only their own deals; everyone else is kept out of homeworker branches)
 *  - org_admin → org-wide (org filter only)
 *
 * The query MUST join the base `transaction` table for these conditions to apply.
 * Unlike `buildScopeConditions`, this is role-aware (an org_admin who happens to
 * carry a branchId is NOT branch-restricted) and does not add the is_test filter.
 */
export function buildTransactionScopeConds(scope: ScopeOrTrusted): SQL[] {
  const conds: SQL[] = [];
  if (scope.orgId === null) return conds; // trusted internal caller — no scoping
  const s = scope as Scope;
  if (s.orgRole === "platform_admin") return conds;

  conds.push(eq(transaction.org_id, s.orgId));

  if ((s.orgRole === "branch_manager" || s.orgRole === "agent") && s.branchId) {
    conds.push(eq(transaction.branch_id, s.branchId));
  }

  const partition = buildPartitionCond(s, transaction.branch_id, transaction.user_id);
  if (partition) conds.push(partition);

  return conds;
}

/**
 * Record-level scope conditions on `transaction` — for opening a SPECIFIC deal
 * (quote/enquiry/booking detail) or listing a specific client's full deal
 * history (the client-details page).
 *
 * Policy: staff roles (org_admin, branch_manager, agent, social_media_manager)
 * may see ALL of a client's deals within their org — no branch pinning.
 * Homeworkers remain restricted to deals they own. Pipeline/dashboard/list
 * queries must keep using `buildTransactionScopeConds`, which pins branch
 * users to their branch.
 */
export function buildTransactionRecordScopeConds(scope: ScopeOrTrusted): SQL[] {
  const conds: SQL[] = [];
  if (scope.orgId === null) return conds; // trusted internal caller — no scoping
  const s = scope as Scope;
  if (s.orgRole === "platform_admin") return conds;

  conds.push(eq(transaction.org_id, s.orgId));

  const partition = buildPartitionCond(s, transaction.branch_id, transaction.user_id);
  if (partition) conds.push(partition);

  return conds;
}

/**
 * WHERE-clause fragments for any query that joins `transaction`. When a branchId is
 * present, scope by `transaction.branch_id`; otherwise scope by the client's orgId
 * (callers must also `innerJoin(clientTable)` — see `needsClientJoin`). Always
 * excludes test transactions.
 */
export function buildScopeConditions(scope: ScopeFilter): SQL[] {
  const conds: SQL[] = [eq(transaction.is_test, false)];
  if (scope.branchId) {
    conds.push(eq(transaction.branch_id, scope.branchId));
  } else if (scope.orgId) {
    conds.push(eq(clientTable.orgId, scope.orgId));
  }
  if (scope.partitionScope) {
    const partition = buildPartitionCond(scope.partitionScope, transaction.branch_id, transaction.user_id);
    if (partition) conds.push(partition);
  }
  return conds;
}

/** True when `buildScopeConditions` references `clientTable.orgId` and so callers must include the client join. */
export function needsClientJoin(scope: ScopeFilter): boolean {
  return !scope.branchId && !!scope.orgId;
}

import { eq, type SQL } from "drizzle-orm";
import { transaction, clientTable } from "@shared/schema";
import type { Scope } from "./scope";

export interface ScopeFilter {
  orgId: string | null;
  branchId: string | null;
}

export type ScopeOrTrusted = Scope | { orgId: null };

/**
 * Role-aware per-request data-scope conditions on the `transaction` table.
 *
 * Mirrors the canonical pattern (buildOpportunityScopeConds / buildTxnScopeConds):
 *  - trusted internal caller ({ orgId: null }) or platform_admin → no restriction
 *  - every other role → confined to their org (transaction.org_id)
 *  - branch_manager / agent (with a branchId) → also confined to their branch
 *  - homeworker (with a userId) → also confined to their own transactions
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
  } else if (s.orgRole === "homeworker" && s.userId) {
    conds.push(eq(transaction.user_id, s.userId));
  }

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
  return conds;
}

/** True when `buildScopeConditions` references `clientTable.orgId` and so callers must include the client join. */
export function needsClientJoin(scope: ScopeFilter): boolean {
  return !scope.branchId && !!scope.orgId;
}

import { eq, type SQL } from "drizzle-orm";
import { transaction, clientTable } from "@shared/schema";

export interface ScopeFilter {
  orgId: string | null;
  branchId: string | null;
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

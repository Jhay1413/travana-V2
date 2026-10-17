import type { ShopResult } from "../types";

export const PLAN_LIMIT_CODE = "BRANCH_LIMIT_REACHED";
export const PLAN_LIMIT_HINT = "Contact us to add more shops";

export interface RowFailure {
  message: string;
  /** The plan's shop limit was hit: show the contact hint beside the message. */
  planLimit: boolean;
}

/** True when the server refused a shop because of the plan's shop limit. */
export function isPlanLimit(result: Pick<ShopResult, "code">): boolean {
  return result.code === PLAN_LIMIT_CODE;
}

/**
 * Split the server's per-shop results into what to show on each submitted row.
 * `rowIds[i]` is the id of the table row that was sent as `shops[i]`.
 */
export function splitShopResults(
  rowIds: string[],
  results: ShopResult[],
): {
  saved: string[];
  failures: Record<string, RowFailure>;
  managerWarnings: Record<string, string>;
  /** Row ids whose shop manager invite went out. */
  managerInvitedRows: string[];
} {
  const saved: string[] = [];
  const failures: Record<string, RowFailure> = {};
  const managerWarnings: Record<string, string> = {};
  const managerInvitedRows: string[] = [];
  for (const result of results) {
    const rowId = rowIds[result.index];
    if (!rowId) continue;
    if (result.status === "error") {
      failures[rowId] = {
        message: result.error?.trim() || "We couldn't create this shop.",
        planLimit: isPlanLimit(result),
      };
      continue;
    }
    saved.push(rowId);
    if (result.managerInvite === "sent") managerInvitedRows.push(rowId);
    if (result.managerInvite === "error") {
      managerWarnings[rowId] = result.managerInviteError?.trim() || "The manager invite could not be sent.";
    }
  }
  return { saved, failures, managerWarnings, managerInvitedRows };
}

/** The line shown under a failed row. */
export function failureText(failure: RowFailure): string {
  return failure.planLimit ? `${failure.message} ${PLAN_LIMIT_HINT}.` : failure.message;
}

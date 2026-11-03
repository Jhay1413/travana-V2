export type TransactionStatus = "on_enquiry" | "on_quote" | "on_booking";

const STATUS_RANK: Record<TransactionStatus, number> = { on_enquiry: 0, on_quote: 1, on_booking: 2 };

function isTransactionStatus(value: unknown): value is TransactionStatus {
  return typeof value === "string" && value in STATUS_RANK;
}

export type StatusTransitionVerdict =
  | { ok: true }
  | { ok: false; message: string };

/** Pure rule for a PATCH that changes a deal's status. Statuses only move
 *  forward (enquiry -> quote -> booking); the target must have the record that
 *  backs it, otherwise the deal would match no pipeline column. */
export function checkStatusTransition(
  from: unknown,
  to: unknown,
  backing: { hasQuote: boolean; hasBooking: boolean },
): StatusTransitionVerdict {
  if (to === undefined || to === from) return { ok: true };
  if (!isTransactionStatus(to)) return { ok: false, message: "Invalid transaction status" };
  if (isTransactionStatus(from) && STATUS_RANK[to] < STATUS_RANK[from]) {
    return { ok: false, message: "A deal cannot move back to an earlier stage" };
  }
  if (to === "on_quote" && !backing.hasQuote) return { ok: false, message: "Cannot move to quote: the deal has no quote" };
  if (to === "on_booking" && !backing.hasBooking) return { ok: false, message: "Cannot move to booking: the deal has no booking" };
  return { ok: true };
}

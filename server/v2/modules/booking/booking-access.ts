import { bookingRepository } from "./booking.repository";
import { AppError } from "../../utils/error-handler";
import { refuseDealWrite } from "../../utils/deal-access";
import type { Scope } from "../../utils/scope";

type ScopeOrTrusted = Scope | { orgId: null };

function isUnscoped(scope: ScopeOrTrusted): boolean {
  if (scope.orgId === null) return true;
  return (scope as Scope).orgRole === "platform_admin" || !(scope as Scope).orgId;
}

/** Record (read) scope: 404 outside the caller's organisation or partition. */
export async function assertBookingReadable(id: string, scope: ScopeOrTrusted): Promise<void> {
  if (isUnscoped(scope)) return;
  if (!(await bookingRepository.bookingInScope(id, scope))) throw new AppError("Booking not found", 404);
}

/** Shop-pinned write scope: 403 for another shop's booking in the same organisation, 404 otherwise. */
export async function assertBookingWritable(id: string, scope: ScopeOrTrusted): Promise<void> {
  if (isUnscoped(scope)) return;
  if (await bookingRepository.bookingInScopeForWrite(id, scope)) return;
  refuseDealWrite(await bookingRepository.bookingInScope(id, scope), "Booking not found");
}

/** Same as assertBookingWritable, for creating or converting a booking on a deal. */
export async function assertBookingDealWritable(transactionId: string, scope: ScopeOrTrusted): Promise<void> {
  if (isUnscoped(scope)) return;
  if (await bookingRepository.transactionInScopeForWrite(transactionId, scope)) return;
  refuseDealWrite(await bookingRepository.transactionInScope(transactionId, scope), "Booking not found");
}

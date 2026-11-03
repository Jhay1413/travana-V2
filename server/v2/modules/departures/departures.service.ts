import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";
import { ukAddDays, ukDateString } from "../../utils/london-dates";
import { departuresRepository } from "./departures.repository";
import { canComplete, patchFor, stampFor, stampWhat, summarise, toDepartureRow, withStored } from "./departures.math";
import type { DepartureAccess, DepartureCheckKey, DepartureRow, DepartureSummary } from "./departures.types";

const DEFAULT_DAYS = 7;

/**
 * Org admins and platform admins see the organisation, a branch manager only their branch. No
 * organisation (or a manager with no branch) fails closed with 403.
 */
export function resolveAccess(scope: Scope): DepartureAccess {
  if (!scope.orgId) throw new AppError("Select an organisation first", 403);
  if (scope.orgRole === "org_admin" || scope.orgRole === "platform_admin") {
    return { orgId: scope.orgId, branchId: null };
  }
  if (!scope.branchId) throw new AppError("No branch context", 403);
  return { orgId: scope.orgId, branchId: scope.branchId };
}

export const departuresService = {
  /** Departures from `from` (default today, London) up to the exclusive `to`. */
  async list(scope: Scope, from?: string, to?: string, now: Date = new Date()): Promise<{ rows: DepartureRow[] }> {
    const access = resolveAccess(scope);
    const raw = await departuresRepository.listRows({ ...access, fromYmd: from ?? ukDateString(now), toExclYmd: to ?? null });
    return { rows: raw.map(toDepartureRow) };
  },

  /** Counts for today up to and including today + days, from one list query. */
  async summary(scope: Scope, days: number = DEFAULT_DAYS, now: Date = new Date()): Promise<DepartureSummary> {
    const access = resolveAccess(scope);
    const today = ukDateString(now);
    const raw = await departuresRepository.listRows({
      ...access,
      fromYmd: today,
      // Day N itself counts ("next 7 days" = today up to and including today + 7).
      toExclYmd: ukDateString(ukAddDays(now, days + 1)),
    });
    return summarise(raw.map(toDepartureRow), today, days);
  },

  /** Tick or untick one check on an in-scope booking, stamp who did it, and return the updated row. */
  async setCheck(
    scope: Scope,
    bookingId: string,
    key: DepartureCheckKey,
    value: boolean,
    now: Date = new Date(),
  ): Promise<DepartureRow> {
    const access = resolveAccess(scope);
    const raw = await departuresRepository.findRow({ ...access, fromYmd: null, toExclYmd: null, bookingId });
    if (!raw) throw new AppError("Booking not found", 404);
    const current = toDepartureRow(raw);

    if (key === "completed" && value && !canComplete(current.checks)) {
      throw new AppError("Tick the four checks first", 400);
    }

    const byName = scope.userId ? await departuresRepository.findUserName(scope.userId) : null;
    const stamp = stampFor(scope.userId, byName, now, stampWhat(key, value));
    const stored = await departuresRepository.upsertCheck(access.orgId, bookingId, patchFor(key, value), stamp);
    return withStored(current, stored);
  },
};

import type {
  CheckStamp,
  DepartureCheckKey,
  DepartureChecks,
  DepartureRawRow,
  DepartureRow,
  DepartureSummary,
  StoredChecks,
} from "./departures.types";

const DAY_MS = 86_400_000;

export const FOUR_CHECKS = ["checkIn", "ticketsInHouse", "passportInfo", "ticketsPickUp"] as const;
type FourCheck = (typeof FOUR_CHECKS)[number];

const LABELS: Record<FourCheck, string> = {
  checkIn: "Check in",
  ticketsInHouse: "Tickets in house",
  passportInfo: "Passport info",
  ticketsPickUp: "Tickets pick up",
};

export function isFourCheck(key: DepartureCheckKey): key is FourCheck {
  return (FOUR_CHECKS as readonly string[]).includes(key);
}

/** Completed unlocks only when all four checks are ticked. */
export function canComplete(c: DepartureChecks): boolean {
  return FOUR_CHECKS.every((k) => c[k]);
}

/** The text stamped as "last change" for a tick or untick. */
export function stampWhat(key: DepartureCheckKey, value: boolean): string {
  if (key === "completed") return value ? "Completed" : "Reopened";
  if (key === "fullyPaid") return value ? "Fully paid" : "Marked not paid";
  return value ? LABELS[key] : `${LABELS[key]} unticked`;
}

/** The columns to write for a tick: the key itself, plus completed=false when a check is unticked. */
export function patchFor(key: DepartureCheckKey, value: boolean): Partial<DepartureChecks> {
  if (isFourCheck(key) && !value) return { [key]: false, completed: false };
  return { [key]: value };
}

function lastChangeOf(
  by: string | null,
  byName: string | null,
  at: Date | null,
  what: string | null,
): DepartureRow["lastChange"] {
  return at && what ? { by, byName, at: at.toISOString(), what } : null;
}

export function toDepartureRow(r: DepartureRawRow): DepartureRow {
  const clientName = `${r.firstName} ${r.surename}`.trim();
  return {
    bookingId: r.bookingId,
    transactionId: r.transactionId,
    clientId: r.clientId,
    clientName,
    leadPassenger: clientName,
    travelDate: r.travelDate,
    nights: r.nights,
    title: r.title,
    destination: r.destination,
    operatorName: r.operatorName,
    operatorLogoUrl: r.operatorLogoUrl,
    haysRef: r.haysRef,
    supplierRef: r.supplierRef,
    checks: {
      checkIn: r.checkIn ?? false,
      ticketsInHouse: r.ticketsInHouse ?? false,
      passportInfo: r.passportInfo ?? false,
      ticketsPickUp: r.ticketsPickUp ?? false,
      completed: r.completed ?? false,
      fullyPaid: r.fullyPaid ?? false,
    },
    lastChange: lastChangeOf(r.lastChangeBy, r.lastChangeByName, r.lastChangeAt, r.lastChangeWhat),
  };
}

/** The row after a write: the stored checks and stamp replace the old ones. */
export function withStored(row: DepartureRow, stored: StoredChecks): DepartureRow {
  const { lastChangeBy, lastChangeByName, lastChangeAt, lastChangeWhat, ...checks } = stored;
  return { ...row, checks, lastChange: lastChangeOf(lastChangeBy, lastChangeByName, lastChangeAt, lastChangeWhat) };
}

export function stampFor(by: string | null, byName: string | null, at: Date, what: string): CheckStamp {
  return { by, byName, at, what };
}

/** Whole days from `todayYmd` to `ymd` (negative = past). Both are YYYY-MM-DD. */
export function daysUntil(todayYmd: string, ymd: string): number {
  return Math.round((Date.parse(`${ymd}T00:00:00Z`) - Date.parse(`${todayYmd}T00:00:00Z`)) / DAY_MS);
}

/** Counts over rows already limited to [today, today + days], day N included. */
export function summarise(rows: DepartureRow[], todayYmd: string, days: number): DepartureSummary {
  const s: DepartureSummary = {
    days, upcoming: rows.length, notCompleted: 0, passportMissing: 0, leavingSoonNotCompleted: 0, notPaid: 0, notPaidSoon: 0,
  };
  for (const r of rows) {
    const left = daysUntil(todayYmd, r.travelDate);
    if (!r.checks.completed) {
      s.notCompleted++;
      if (left <= 3) s.leavingSoonNotCompleted++;
    }
    if (!r.checks.passportInfo) s.passportMissing++;
    if (!r.checks.fullyPaid) {
      s.notPaid++;
      if (left <= 7) s.notPaidSoon++;
    }
  }
  return s;
}

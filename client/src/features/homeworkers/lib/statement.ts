import { currencyFull } from "@/features/organization/components/organization-overview/helpers";
import type { StatementBookingLine, StatementFigures, StatementLine, StatementResult, StatementUpsellLine } from "../statement-types";

export interface MonthRef {
  year: number;
  /** 1-12 */
  month: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function monthKey(m: MonthRef): string {
  return `${m.year}-${pad(m.month)}`;
}

export function parseMonthKey(key: string): MonthRef | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(match[1]), month };
}

/** Month containing `now`, in UTC (the server compares periods against the UTC date). */
export function currentMonth(now: Date = new Date()): MonthRef {
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

/** Statement period for a month: from = first day, to = first day of the NEXT month (exclusive). */
export function monthPeriod(m: MonthRef): { from: string; to: string } {
  const nextYear = m.month === 12 ? m.year + 1 : m.year;
  const nextMonth = m.month === 12 ? 1 : m.month + 1;
  return { from: `${m.year}-${pad(m.month)}-01`, to: `${nextYear}-${pad(nextMonth)}-01` };
}

export function shiftMonth(m: MonthRef, delta: number): MonthRef {
  const index = m.year * 12 + (m.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Finalise is allowed once the exclusive end date is today or earlier (UTC), matching the server. */
export function canFinalise(periodTo: string, now: Date = new Date()): boolean {
  return periodTo <= now.toISOString().slice(0, 10);
}

/** Finalise button rule: period ended, not already finalised, and not mid-request. */
export function finaliseEnabled(result: Pick<StatementResult, "period" | "finalised"> | undefined, pending: boolean, now: Date = new Date()): boolean {
  if (!result || pending || result.finalised) return false;
  return canFinalise(result.period.to, now);
}

export function monthLabel(m: MonthRef): string {
  return new Date(Date.UTC(m.year, m.month - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export interface GroupedLines {
  bookings: StatementBookingLine[];
  upsells: StatementUpsellLine[];
}

export function groupLines(lines: readonly StatementLine[]): GroupedLines {
  const bookings: StatementBookingLine[] = [];
  const upsells: StatementUpsellLine[] = [];
  for (const line of lines) {
    if (line.type === "booking") bookings.push(line);
    else upsells.push(line);
  }
  return { bookings, upsells };
}

/** The server already returns frozen figures at the top level when finalised; this only adds the flag. */
export function displayFigures(result: StatementResult): StatementFigures {
  return {
    gross: result.gross,
    sharePercent: result.sharePercent,
    homeworkerShare: result.homeworkerShare,
    orgShare: result.orgShare,
    frozen: result.finalised !== null,
  };
}

/** Warning text when live figures drifted from the frozen statement; null otherwise. */
export function driftMessage(result: Pick<StatementResult, "driftWarning" | "liveGross">): string | null {
  if (!result.driftWarning) return null;
  return `Figures have changed since this statement was finalised; live gross: ${formatMoney(result.liveGross)}`;
}

/** Display only: the server sends decimal strings; no money maths happens on the client. */
export function formatMoney(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "–";
  const n = Number(value);
  return Number.isFinite(n) ? currencyFull.format(n) : "–";
}

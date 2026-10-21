// Status pill, summary line and meta text of the "Departures and balances" dashboard card (live data).
import { plural } from "./money";
import type { PillTone } from "@/components/shared/status-pill";

export interface CardChecks {
  completed: boolean;
  fullyPaid: boolean;
  passportInfo: boolean;
}

export interface CardPill {
  label: string;
  tone: PillTone;
}

/** All set / Passport info missing / Balance not paid / Checks outstanding. */
export function cardPill(c: CardChecks): CardPill {
  if (c.completed && c.fullyPaid) return { label: "All set", tone: "good" };
  if (!c.passportInfo) return { label: "Passport info missing", tone: "bad" };
  if (!c.fullyPaid) return { label: "Balance not paid", tone: "warn" };
  return { label: "Checks outstanding", tone: "plain" };
}

/** A departure still needs someone to act unless it is all set. */
export function needsAction(c: CardChecks): boolean {
  return !(c.completed && c.fullyPaid);
}

export interface CardSummary {
  upcoming: number;
  notPaid: number;
  passportMissing: number;
}

/** "5 departures · 3 not fully paid · 1 passport info missing", or "..., nothing outstanding." */
export function cardSummaryLine(s: CardSummary): string {
  const bits = [plural(s.upcoming, "departure")];
  if (s.notPaid > 0) bits.push(`${s.notPaid} not fully paid`);
  if (s.passportMissing > 0) bits.push(`${s.passportMissing} passport info missing`);
  return bits.length === 1 ? `${bits[0]}, nothing outstanding.` : bits.join(" · ");
}

/** Same counts worked out from the card's own rows (used until the summary has loaded). */
export function summaryFromRows(rows: ReadonlyArray<{ checks: CardChecks }>): CardSummary {
  return {
    upcoming: rows.length,
    notPaid: rows.filter((r) => !r.checks.fullyPaid).length,
    passportMissing: rows.filter((r) => !r.checks.passportInfo).length,
  };
}

/** "7 nights · Jet2holidays" (parts that are missing are left out). */
export function departureMeta(nights: number | null, operator: string | null): string {
  return [nights ? plural(nights, "night") : null, operator].filter(Boolean).join(" · ");
}

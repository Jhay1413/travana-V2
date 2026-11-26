import { formatDay } from "./quote-format";

export interface HeldLine {
  /** True while the price is still held (the expiry is today or later). */
  held: boolean;
  text: string;
}

const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });

/** The UK calendar day of an instant, as YYYY-MM-DD. */
function ukDay(date: Date): string {
  return dayFormatter.format(date);
}

function dayNumber(isoDay: string): number {
  const [y, m, d] = isoDay.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

/**
 * The "price held" line for a quote, or null when the quote has no real expiry date (nothing is invented:
 * no expiry means no line). Counts UK calendar days, so the line changes at midnight in the UK.
 */
export function heldUntilLine(expiry: string | null | undefined, now: Date = new Date()): HeldLine | null {
  if (!expiry) return null;
  const expiryDate = new Date(expiry);
  if (Number.isNaN(expiryDate.getTime())) return null;
  const label = formatDay(ukDay(expiryDate));
  const days = dayNumber(ukDay(expiryDate)) - dayNumber(ukDay(now));
  if (days < 0) return { held: false, text: `The held price ended on ${label}` };
  if (days === 0) return { held: true, text: `Price held until today, ${label}` };
  if (days === 1) return { held: true, text: `Price held until tomorrow, ${label}` };
  return { held: true, text: `Price held for ${days} more days, until ${label}` };
}

/** Whole UK days left at the held price (0 today); null when there is no expiry or it has passed. */
export function daysLeft(expiry: string | null | undefined, now: Date = new Date()): number | null {
  if (!expiry) return null;
  const expiryDate = new Date(expiry);
  if (Number.isNaN(expiryDate.getTime())) return null;
  const days = dayNumber(ukDay(expiryDate)) - dayNumber(ukDay(now));
  return days < 0 ? null : days;
}

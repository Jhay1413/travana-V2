/** Dates on the passport screens: shown as "22 Oct 2032", typed in any common way, sent to the server as YYYY-MM-DD. */

import { addMonthsYmd } from "@shared/passenger-rules";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const MONTH_LOOKUP: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function isRealDate(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 1000 || y > 9999 || m < 1 || m > 12 || d < 1) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const pad = (n: number, width: number) => String(n).padStart(width, "0");

/** YYYY-MM-DD for a real calendar day, else null. */
export function toIsoDate(y: number, m: number, d: number): string | null {
  return isRealDate(y, m, d) ? `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}` : null;
}

/**
 * "9 Feb 2031" from an ISO date (read as written, no time-zone shift). "" for nothing or a value that is not a date.
 * Fixed month names (not the browser's locale) so every browser shows the same text.
 */
export function formatPassportDate(iso: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!match) return "";
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (!isRealDate(y, m, d)) return "";
  return `${d} ${MONTH_SHORT[m - 1]} ${y}`;
}

/**
 * Reads a date the way a person writes it and returns YYYY-MM-DD, or null when it is not a real date.
 * Accepts: "22 Oct 2032", "22 October 2032", "22oct2032", "Oct 22, 2032", "22/10/2032", "22-10-2032", "22.10.2032",
 * "22 10 2032" and "2032-10-22". Numbers are day first (UK). A year must have four digits: "22/10/32" is refused
 * rather than guessed, since a passport date a century out is easy to miss.
 */
export function parsePassportDate(input: string | null | undefined): string | null {
  const text = (input ?? "").trim().replace(/\s+/g, " ");
  if (!text) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (iso) return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const numeric = /^(\d{1,2})\s*[/.\- ]\s*(\d{1,2})\s*[/.\- ]\s*(\d{4})$/.exec(text);
  if (numeric) return toIsoDate(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));

  const dayFirst = /^(\d{1,2})(?:st|nd|rd|th)?[ .\-/]*([A-Za-z]{3,9})\.?,?[ .\-/]*(\d{4})$/.exec(text);
  if (dayFirst) {
    const month = MONTH_LOOKUP[dayFirst[2].toLowerCase()];
    return month ? toIsoDate(Number(dayFirst[3]), month, Number(dayFirst[1])) : null;
  }

  const monthFirst = /^([A-Za-z]{3,9})\.?[ .\-/]*(\d{1,2})(?:st|nd|rd|th)?,?[ .\-/]*(\d{4})$/.exec(text);
  if (monthFirst) {
    const month = MONTH_LOOKUP[monthFirst[1].toLowerCase()];
    return month ? toIsoDate(Number(monthFirst[3]), month, Number(monthFirst[2])) : null;
  }

  return null;
}

/** Today's date on this device as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1, 2)}-${pad(now.getDate(), 2)}`;
}

/** Adds whole months to a YYYY-MM-DD, clamping to the month's last day (31 Aug + 6 months = 28 Feb): the server's own rule. */
export function addMonthsIso(iso: string, months: number): string {
  return addMonthsYmd(iso.slice(0, 10), months);
}

/** The long form the server writes in its sentences: "4 May 2027". */
export function formatLongPassportDate(iso: string): string {
  const LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${LONG[(m ?? 1) - 1]} ${y}`;
}

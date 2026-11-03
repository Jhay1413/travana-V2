/**
 * Date helpers for the e2e expectations. The expectations reuse the app's own London date helpers, so a wrong helper would
 * make the app and its test agree on a wrong answer. To stop that, each spec calls `pinLondonHelpers(...)` at the top: it
 * registers a few tests that check the helpers it uses against answers worked out by hand (no helper in the expectation).
 */
import { expect, test } from "@playwright/test";
import { addMonths, format, parse } from "date-fns";
import { londonDateTimeToIso } from "../../client/src/features/tickets/lib/london-datetime";
import { addDaysToKey, londonDayKey, londonDayStart, londonWeekStartKey } from "../../client/src/lib/london-day";
import { ukAddDays, ukDateString, ukMonthEnd, ukStartOfDay, ukStartOfMonth, ukStartOfWeek } from "../../server/v2/utils/london-dates";

/** The instant at which the clock in London shows this date and time (DST-safe; do not use 00:00 or 01:00). */
export function londonAt(dateKey: string, hhmm: string): Date {
  const iso = londonDateTimeToIso(dateKey, hhmm);
  if (!iso) throw new Error(`Not a London date and time: ${dateKey} ${hhmm}`);
  return new Date(iso);
}

/** YYYY-MM-DD plus whole calendar months, clamped to the month end, the way the app (date-fns addMonths) does it. */
export function plusMonths(ymd: string, months: number): string {
  return format(addMonths(parse(ymd, "yyyy-MM-dd", new Date()), months), "yyyy-MM-dd");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Fri 4 Sep 2026" for a YYYY-MM-DD, written from fixed names (Intl spells September "Sept" in some versions). */
export function shortLongDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} ${d} ${MONTHS[m - 1]} ${y}`;
}

export type LondonPin = "day" | "week" | "month" | "dateTime" | "months" | "dayLabel";

const iso = (d: Date) => d.toISOString();

/** Registers the hand-checked cases for the helpers a spec relies on. Call once at the top level of a spec. */
export function pinLondonHelpers(...which: LondonPin[]): void {
  test.describe("date helpers used by these expectations (checked against hand-worked answers)", () => {
    if (which.includes("day")) {
      test("a London day starts at 23:00Z in summer and at midnight Z in winter, including on clock-change days", () => {
        expect(iso(londonDayStart("2026-07-01"))).toBe("2026-06-30T23:00:00.000Z");
        expect(iso(londonDayStart("2026-01-15"))).toBe("2026-01-15T00:00:00.000Z");
        expect(iso(londonDayStart("2026-03-29"))).toBe("2026-03-29T00:00:00.000Z"); // clocks go forward at 01:00 that day
        expect(iso(londonDayStart("2026-03-30"))).toBe("2026-03-29T23:00:00.000Z");
        expect(iso(londonDayStart("2026-10-25"))).toBe("2026-10-24T23:00:00.000Z"); // clocks go back at 02:00 that day
        expect(iso(londonDayStart("2026-10-26"))).toBe("2026-10-26T00:00:00.000Z");
        // The server helper agrees, and 23:30 vs 00:30 UK are different days.
        expect(iso(ukStartOfDay(new Date("2026-07-01T22:30:00Z")))).toBe("2026-06-30T23:00:00.000Z");
        expect(iso(ukStartOfDay(new Date("2026-07-01T23:30:00Z")))).toBe("2026-07-01T23:00:00.000Z");
        expect(iso(ukStartOfDay(new Date("2026-01-15T23:30:00Z")))).toBe("2026-01-15T00:00:00.000Z");
        expect(iso(ukStartOfDay(new Date("2026-01-16T00:30:00Z")))).toBe("2026-01-16T00:00:00.000Z");
        expect(londonDayKey(new Date("2026-06-30T23:30:00Z"))).toBe("2026-07-01");
        expect(ukDateString(new Date("2026-06-30T23:30:00Z"))).toBe("2026-07-01");
        expect(ukDateString(new Date("2026-07-01T22:30:00Z"))).toBe("2026-07-01");
        expect(addDaysToKey("2026-02-28", 1)).toBe("2026-03-01");
        // Adding a day keeps London midnight across the October clock change (25 Oct 00:00 BST -> 26 Oct 00:00 GMT).
        expect(iso(ukAddDays(new Date("2026-10-24T23:00:00Z"), 1))).toBe("2026-10-26T00:00:00.000Z");
      });
    }
    if (which.includes("week")) {
      test("the week starts on the UK Monday", () => {
        expect(iso(ukStartOfWeek(new Date("2026-07-01T12:00:00Z")))).toBe("2026-06-28T23:00:00.000Z"); // Wed 1 Jul -> Mon 29 Jun 00:00 BST
        expect(iso(ukStartOfWeek(new Date("2026-07-05T12:00:00Z")))).toBe("2026-06-28T23:00:00.000Z"); // Sunday is still that week
        expect(iso(ukStartOfWeek(new Date("2026-06-28T23:30:00Z")))).toBe("2026-06-28T23:00:00.000Z"); // 00:30 BST Monday
        expect(iso(ukStartOfWeek(new Date("2026-01-14T12:00:00Z")))).toBe("2026-01-12T00:00:00.000Z");
        expect(londonWeekStartKey("2026-07-01")).toBe("2026-06-29");
        expect(londonWeekStartKey("2026-07-05")).toBe("2026-06-29");
        expect(londonWeekStartKey("2026-06-29")).toBe("2026-06-29");
      });
    }
    if (which.includes("month")) {
      test("the month starts on the UK 1st and ends at the UK midnight that opens the next month", () => {
        expect(iso(ukStartOfMonth(new Date("2026-07-15T12:00:00Z")))).toBe("2026-06-30T23:00:00.000Z");
        expect(iso(ukMonthEnd(new Date("2026-07-15T12:00:00Z")))).toBe("2026-07-31T23:00:00.000Z");
        expect(iso(ukStartOfMonth(new Date("2026-07-31T23:30:00Z")))).toBe("2026-07-31T23:00:00.000Z"); // 00:30 BST on 1 Aug
        expect(iso(ukMonthEnd(new Date("2026-12-10T12:00:00Z")))).toBe("2027-01-01T00:00:00.000Z");
      });
    }
    if (which.includes("dateTime")) {
      test("a London date and clock time becomes the right instant, including on clock-change days", () => {
        expect(londonDateTimeToIso("2026-07-01", "09:00")).toBe("2026-07-01T08:00:00.000Z");
        expect(londonDateTimeToIso("2026-12-10", "14:30")).toBe("2026-12-10T14:30:00.000Z");
        expect(londonDateTimeToIso("2026-03-29", "12:00")).toBe("2026-03-29T11:00:00.000Z"); // BST has started
        expect(londonDateTimeToIso("2026-10-25", "12:00")).toBe("2026-10-25T12:00:00.000Z"); // GMT again
        expect(londonDateTimeToIso("2026-10-25", "23:30")).toBe("2026-10-25T23:30:00.000Z");
        expect(londonDateTimeToIso("2026-10-24", "23:30")).toBe("2026-10-24T22:30:00.000Z");
        expect(iso(londonAt("2026-03-28", "10:15"))).toBe("2026-03-28T10:15:00.000Z");
      });
    }
    if (which.includes("months")) {
      test("adding months clamps to the month end", () => {
        expect(plusMonths("2026-08-31", 6)).toBe("2027-02-28");
        expect(plusMonths("2027-08-31", 6)).toBe("2028-02-29");
        expect(plusMonths("2026-01-15", 7)).toBe("2026-08-15");
        expect(plusMonths("2026-11-30", 3)).toBe("2027-02-28");
      });
    }
    if (which.includes("dayLabel")) {
      test("the long date label uses fixed English names", () => {
        expect(shortLongDate("2026-09-04")).toBe("Fri 4 Sep 2026");
        expect(shortLongDate("2026-01-01")).toBe("Thu 1 Jan 2026");
      });
    }
  });
}

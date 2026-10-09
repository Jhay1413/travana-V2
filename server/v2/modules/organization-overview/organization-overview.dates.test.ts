import { describe, it, expect } from "vitest";
import {
  ukStartOfDay,
  ukStartOfWeek,
  ukStartOfMonth,
  ukMonthEnd,
  ukStartOfYear,
  ukAddDays,
  ukDateString,
  ukMonthName,
} from "./organization-overview.dates";

describe("organization-overview UK date boundaries", () => {
  it("BST: London midnight is 23:00Z the previous day", () => {
    const d = new Date("2026-07-15T12:30:00Z");
    expect(ukStartOfDay(d).toISOString()).toBe("2026-07-14T23:00:00.000Z");
    expect(ukStartOfMonth(d).toISOString()).toBe("2026-06-30T23:00:00.000Z");
    expect(ukMonthEnd(d).toISOString()).toBe("2026-07-31T23:00:00.000Z");
    // Wed 15 Jul 2026 -> Monday 13 Jul
    expect(ukStartOfWeek(d).toISOString()).toBe("2026-07-12T23:00:00.000Z");
    expect(ukDateString(d)).toBe("2026-07-15");
    expect(ukMonthName(d)).toBe("July");
  });

  it("BST: 23:30Z is already the next London day", () => {
    const d = new Date("2026-07-15T23:30:00Z");
    expect(ukStartOfDay(d).toISOString()).toBe("2026-07-15T23:00:00.000Z");
    expect(ukDateString(d)).toBe("2026-07-16");
  });

  it("GMT: London midnight equals UTC midnight", () => {
    const d = new Date("2026-01-14T12:00:00Z");
    expect(ukStartOfDay(d).toISOString()).toBe("2026-01-14T00:00:00.000Z");
    expect(ukStartOfMonth(d).toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(ukStartOfYear(d).toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(ukMonthEnd(d).toISOString()).toBe("2026-02-01T00:00:00.000Z");
    // Wed 14 Jan 2026 -> Monday 12 Jan
    expect(ukStartOfWeek(d).toISOString()).toBe("2026-01-12T00:00:00.000Z");
  });

  it("spring-forward Sunday (29 Mar 2026) is a 23h day", () => {
    const d = new Date("2026-03-29T12:00:00Z");
    const start = ukStartOfDay(d);
    expect(start.toISOString()).toBe("2026-03-29T00:00:00.000Z");
    const next = ukAddDays(start, 1);
    expect(next.toISOString()).toBe("2026-03-29T23:00:00.000Z");
    expect((next.getTime() - start.getTime()) / 3_600_000).toBe(23);
    // Week containing it starts Monday 23 Mar (GMT)
    expect(ukStartOfWeek(d).toISOString()).toBe("2026-03-23T00:00:00.000Z");
    // March ends in BST
    expect(ukMonthEnd(d).toISOString()).toBe("2026-03-31T23:00:00.000Z");
  });

  it("fall-back Sunday (25 Oct 2026) is a 25h day", () => {
    const d = new Date("2026-10-25T12:00:00Z");
    const start = ukStartOfDay(d);
    expect(start.toISOString()).toBe("2026-10-24T23:00:00.000Z");
    const next = ukAddDays(start, 1);
    expect(next.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect((next.getTime() - start.getTime()) / 3_600_000).toBe(25);
    expect(ukStartOfWeek(d).toISOString()).toBe("2026-10-18T23:00:00.000Z");
    expect(ukMonthEnd(d).toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });
});

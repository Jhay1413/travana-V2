import { describe, it, expect } from "vitest";
import { getLondonWindows, getLondonDayRange } from "./london-time";

const iso = (d: Date | undefined) => d?.toISOString();

describe("getLondonWindows", () => {
  it("BST: boundaries are London midnight (UTC-1h), week starts Monday", () => {
    // Fri 16 Oct 2026 13:00 BST
    const w = getLondonWindows(new Date("2026-10-16T12:00:00Z"));
    expect(iso(w.todayStart)).toBe("2026-10-15T23:00:00.000Z");
    expect(iso(w.tomorrowStart)).toBe("2026-10-16T23:00:00.000Z");
    expect(iso(w.yesterdayStart)).toBe("2026-10-14T23:00:00.000Z");
    expect(iso(w.weekStart)).toBe("2026-10-11T23:00:00.000Z"); // Mon 12 Oct 00:00 BST
    expect(iso(w.monthStart)).toBe("2026-09-30T23:00:00.000Z");
    expect(iso(w.monthEnd)).toBe("2026-11-01T00:00:00.000Z"); // GMT again by 1 Nov
  });

  it("GMT: boundaries equal UTC midnight; a Monday is its own week start", () => {
    const w = getLondonWindows(new Date("2026-01-05T10:00:00Z"));
    expect(iso(w.todayStart)).toBe("2026-01-05T00:00:00.000Z");
    expect(iso(w.weekStart)).toBe("2026-01-05T00:00:00.000Z");
    expect(iso(w.monthStart)).toBe("2026-01-01T00:00:00.000Z");
    expect(iso(w.monthEnd)).toBe("2026-02-01T00:00:00.000Z");
  });

  it("spring-forward day (Sun 29 Mar 2026): today starts in GMT, tomorrow in BST", () => {
    const w = getLondonWindows(new Date("2026-03-29T12:00:00Z"));
    expect(iso(w.todayStart)).toBe("2026-03-29T00:00:00.000Z");
    expect(iso(w.tomorrowStart)).toBe("2026-03-29T23:00:00.000Z");
    expect(iso(w.weekStart)).toBe("2026-03-23T00:00:00.000Z");
    expect(iso(w.monthEnd)).toBe("2026-03-31T23:00:00.000Z");
  });

  it("fall-back day (Sun 25 Oct 2026): today starts in BST, tomorrow in GMT", () => {
    const w = getLondonWindows(new Date("2026-10-25T12:00:00Z"));
    expect(iso(w.todayStart)).toBe("2026-10-24T23:00:00.000Z");
    expect(iso(w.tomorrowStart)).toBe("2026-10-26T00:00:00.000Z");
    expect(iso(w.weekStart)).toBe("2026-10-18T23:00:00.000Z"); // Mon 19 Oct 00:00 BST
  });

  it("Sunday late evening still belongs to the week that started the previous Monday", () => {
    // 23:30 BST Sunday 11 Oct 2026
    const w = getLondonWindows(new Date("2026-10-11T22:30:00Z"));
    expect(iso(w.weekStart)).toBe("2026-10-04T23:00:00.000Z"); // Mon 5 Oct
    expect(iso(w.todayStart)).toBe("2026-10-10T23:00:00.000Z");
  });

  it("00:30 BST Monday is already the new week (server UTC clock still says Sunday)", () => {
    const w = getLondonWindows(new Date("2026-10-11T23:30:00Z"));
    expect(iso(w.weekStart)).toBe("2026-10-11T23:00:00.000Z");
    expect(iso(w.todayStart)).toBe("2026-10-11T23:00:00.000Z");
  });

  it("month rollover: 00:30 BST on 1 Jul is July although UTC says 30 Jun", () => {
    const w = getLondonWindows(new Date("2026-06-30T23:30:00Z"));
    expect(iso(w.monthStart)).toBe("2026-06-30T23:00:00.000Z");
    expect(iso(w.monthEnd)).toBe("2026-07-31T23:00:00.000Z");
  });

  it("year rollover: December month ends at 1 Jan 00:00 GMT", () => {
    const w = getLondonWindows(new Date("2026-12-31T23:30:00Z"));
    expect(iso(w.monthStart)).toBe("2026-12-01T00:00:00.000Z");
    expect(iso(w.monthEnd)).toBe("2027-01-01T00:00:00.000Z");
    expect(iso(w.tomorrowStart)).toBe("2027-01-01T00:00:00.000Z");
  });

  it("week can start in the previous month", () => {
    // Wed 1 Apr 2026 12:00 BST -> Monday 30 Mar 00:00 BST
    const w = getLondonWindows(new Date("2026-04-01T11:00:00Z"));
    expect(iso(w.weekStart)).toBe("2026-03-29T23:00:00.000Z");
  });
});

describe("getLondonDayRange", () => {
  const now = new Date("2026-10-16T12:00:00Z");

  it("today is open-ended from London midnight", () => {
    expect(getLondonDayRange("today", now)).toEqual({ from: new Date("2026-10-15T23:00:00Z") });
  });

  it("yesterday is the previous London day, upper bound exclusive", () => {
    expect(getLondonDayRange("yesterday", now)).toEqual({
      from: new Date("2026-10-14T23:00:00Z"),
      to: new Date("2026-10-15T23:00:00Z"),
    });
  });

  it("week starts Monday 00:00 London", () => {
    expect(getLondonDayRange("week", now)).toEqual({ from: new Date("2026-10-11T23:00:00Z") });
  });
});

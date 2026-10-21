import { describe, it, expect } from "vitest";
import { canComplete, daysUntil, patchFor, stampWhat, summarise } from "./departures.math";
import type { DepartureChecks, DepartureRow } from "./departures.types";

const NONE: DepartureChecks = { checkIn: false, ticketsInHouse: false, passportInfo: false, ticketsPickUp: false, completed: false, fullyPaid: false };

function row(travelDate: string, checks: Partial<DepartureChecks> = {}): DepartureRow {
  return {
    bookingId: travelDate, transactionId: "t", clientId: "c", clientName: "A B", leadPassenger: "A B", travelDate,
    nights: 7, title: null, destination: null, operatorName: null, operatorLogoUrl: null, haysRef: "H", supplierRef: "S",
    checks: { ...NONE, ...checks }, lastChange: null,
  };
}

describe("canComplete", () => {
  it("needs all four checks, ignoring completed and fullyPaid", () => {
    expect(canComplete({ ...NONE, checkIn: true, ticketsInHouse: true, passportInfo: true, ticketsPickUp: true })).toBe(true);
    expect(canComplete({ ...NONE, checkIn: true, ticketsInHouse: true, passportInfo: true })).toBe(false);
    expect(canComplete({ ...NONE, fullyPaid: true, completed: true })).toBe(false);
  });
});

describe("patchFor", () => {
  it("unticking one of the four also clears completed", () => {
    expect(patchFor("checkIn", false)).toEqual({ checkIn: false, completed: false });
  });
  it("other changes write only their own column", () => {
    expect(patchFor("checkIn", true)).toEqual({ checkIn: true });
    expect(patchFor("completed", false)).toEqual({ completed: false });
    expect(patchFor("fullyPaid", false)).toEqual({ fullyPaid: false });
  });
});

describe("stampWhat", () => {
  it("covers every key", () => {
    expect(stampWhat("checkIn", true)).toBe("Check in");
    expect(stampWhat("checkIn", false)).toBe("Check in unticked");
    expect(stampWhat("completed", true)).toBe("Completed");
    expect(stampWhat("completed", false)).toBe("Reopened");
    expect(stampWhat("fullyPaid", true)).toBe("Fully paid");
    expect(stampWhat("fullyPaid", false)).toBe("Marked not paid");
  });
});

describe("daysUntil", () => {
  it("counts whole calendar days, across a DST change", () => {
    expect(daysUntil("2026-10-20", "2026-10-20")).toBe(0);
    expect(daysUntil("2026-10-20", "2026-10-23")).toBe(3);
    expect(daysUntil("2026-10-24", "2026-10-27")).toBe(3);
    expect(daysUntil("2026-10-20", "2026-10-19")).toBe(-1);
  });
});

describe("summarise", () => {
  const TODAY = "2026-10-20";

  it("is all zeros for an empty window", () => {
    expect(summarise([], TODAY, 7)).toEqual({
      days: 7, upcoming: 0, notCompleted: 0, passportMissing: 0, leavingSoonNotCompleted: 0, notPaid: 0, notPaidSoon: 0,
    });
  });

  it("counts not completed, passport missing, leaving soon (3 days) and not paid (7 days)", () => {
    const rows = [
      row("2026-10-20"),
      row("2026-10-23", { passportInfo: true }),
      row("2026-10-24", { passportInfo: true, fullyPaid: true }),
      row("2026-10-26", { completed: true, passportInfo: true, fullyPaid: true }),
      row("2026-11-15", { passportInfo: true }),
    ];
    expect(summarise(rows, TODAY, 30)).toEqual({
      days: 30,
      upcoming: 5,
      notCompleted: 4,
      passportMissing: 1,
      leavingSoonNotCompleted: 2,
      notPaid: 3,
      notPaidSoon: 2,
    });
  });

  it("a completed trip leaving tomorrow is not leaving-soon", () => {
    expect(summarise([row("2026-10-21", { completed: true })], TODAY, 7).leavingSoonNotCompleted).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { cardPill, cardSummaryLine, departureMeta, needsAction, summaryFromRows } from "./departure-pill";

const OK = { completed: true, fullyPaid: true, passportInfo: true };

describe("cardPill", () => {
  it("is All set only when completed and fully paid", () => {
    expect(cardPill(OK)).toEqual({ label: "All set", tone: "good" });
  });
  it("flags missing passport info first", () => {
    expect(cardPill({ completed: false, fullyPaid: false, passportInfo: false })).toEqual({ label: "Passport info missing", tone: "bad" });
  });
  it("flags an unpaid balance", () => {
    expect(cardPill({ completed: false, fullyPaid: false, passportInfo: true })).toEqual({ label: "Balance not paid", tone: "warn" });
    expect(cardPill({ completed: true, fullyPaid: false, passportInfo: true })).toEqual({ label: "Balance not paid", tone: "warn" });
  });
  it("falls back to checks outstanding", () => {
    expect(cardPill({ completed: false, fullyPaid: true, passportInfo: true })).toEqual({ label: "Checks outstanding", tone: "plain" });
  });
});

describe("needsAction", () => {
  it("is false only for All set", () => {
    expect(needsAction(OK)).toBe(false);
    expect(needsAction({ ...OK, completed: false })).toBe(true);
    expect(needsAction({ ...OK, fullyPaid: false })).toBe(true);
  });
});

describe("summary", () => {
  it("lists what is outstanding", () => {
    expect(cardSummaryLine({ upcoming: 5, notPaid: 3, passportMissing: 1 })).toBe("5 departures · 3 not fully paid · 1 passport info missing");
  });
  it("says nothing is outstanding", () => {
    expect(cardSummaryLine({ upcoming: 1, notPaid: 0, passportMissing: 0 })).toBe("1 departure, nothing outstanding.");
  });
  it("derives counts from rows", () => {
    const rows = [{ checks: OK }, { checks: { completed: false, fullyPaid: false, passportInfo: false } }];
    expect(summaryFromRows(rows)).toEqual({ upcoming: 2, notPaid: 1, passportMissing: 1 });
  });
});

describe("departureMeta", () => {
  it("joins nights and operator, skipping gaps", () => {
    expect(departureMeta(7, "Jet2holidays")).toBe("7 nights · Jet2holidays");
    expect(departureMeta(1, null)).toBe("1 night");
    expect(departureMeta(null, null)).toBe("");
  });
});

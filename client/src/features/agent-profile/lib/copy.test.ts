import { describe, expect, it } from "vitest";
import { beforeStartNote, windowBeforeStart } from "./before-start";
import { makePerformance } from "./__fixtures__/agent-profile.fixtures";
import { buildHealthCopy } from "./health-copy";
import { bookingsSub, ppbValue, showingLine, targetSummary } from "./hero-copy";
import { startedLine, tenureText } from "./tenure";

describe("hero copy", () => {
  it("words the bookings line with and without quotes", () => {
    expect(bookingsSub(3, 12)).toBe("3 bookings from 12 quotes sent");
    expect(bookingsSub(1, 1)).toBe("1 booking from 1 quote sent");
    expect(bookingsSub(1, 0)).toBe("1 booking made");
    expect(bookingsSub(0, 0)).toBe("0 bookings made");
  });

  it("has no average profit per booking without bookings", () => {
    expect(ppbValue(1000, 4)).toBe(250);
    expect(ppbValue(0, 0)).toBeNull();
  });

  it("summarises progress to the period target", () => {
    expect(targetSummary(1250, 2500)).toMatchObject({ kind: "progress", pct: 50, value: "£2,500", text: "50% reached · £1,250 still to make" });
    expect(targetSummary(3000, 2500)).toMatchObject({ pct: 100, text: "100% reached · target beaten" });
    expect(targetSummary(2500, 2500).text).toContain("target beaten");
    expect(targetSummary(500, 0)).toMatchObject({ kind: "none", value: "Not set", pct: 0 });
  });

  it("opens the section with a status line", () => {
    expect(showingLine("Tina", "this month")).toBe("Showing Tina's figures for this month.");
  });
});

describe("health copy", () => {
  it("reads views per quote, close rate from quoted deals and the agency average", () => {
    const c = buildHealthCopy(makePerformance());
    expect(c.views).toEqual({ value: "30", sub: "From 20 quotes sent, so 1.5 views per quote" });
    expect(c.closeRate).toEqual({ value: "40%", sub: "4 bookings from 10 quoted deals" });
    expect(c.commission.value).toBe("10.00%");
    expect(c.commission.barPct).toBe(80);
    expect(c.commission.sub).toBe("Agency average 7.41%");
  });

  it("names the branch for branch managers and omits the average when unknown", () => {
    const branch = buildHealthCopy(makePerformance({ comparator: { scope: "branch", label: "Leeds", profit: 1, bookings: 1, sales: 1, avgCommissionRate: 6 } }));
    expect(branch.commission.sub).toBe("Branch average 6.00%");
    const none = buildHealthCopy(makePerformance({ comparator: { scope: "organisation", label: "x", profit: 0, bookings: 0, sales: 0, avgCommissionRate: null } }));
    expect(none.commission.sub).toBeNull();
  });

  it("shows dashes when there is nothing to divide by", () => {
    const c = buildHealthCopy(makePerformance({ quotedDeals: 0, quotesSent: 0, quoteViews: 0, bookings: 0, commissionRate: null, closeRate: 0 }));
    expect(c.closeRate).toEqual({ value: "—", sub: "No quoted deals in this period" });
    expect(c.views.sub).toBe("From 0 quotes sent, so 0 views per quote");
    expect(c.commission).toMatchObject({ value: "—", barPct: 0 });
  });
});

describe("before-start note", () => {
  it("applies only when the whole window ends on or before the start day", () => {
    expect(windowBeforeStart("2026-10-01", "2026-10-01")).toBe(true);
    expect(windowBeforeStart("2026-10-02", "2026-10-01")).toBe(false);
    expect(windowBeforeStart("2026-09-01", "2026-10-12T09:00:00.000Z")).toBe(true);
  });

  it("words the note for figures and earnings", () => {
    expect(beforeStartNote("Mason", "2026-10-12", "figures")).toBe("Mason started on 12 Oct 2026, so there are no figures for this period.");
    expect(beforeStartNote("Mason", "2026-10-12", "earnings")).toContain("no earnings");
  });
});

describe("tenure", () => {
  it("counts whole months and years", () => {
    expect(tenureText("2024-03-12", "2026-10-19")).toBe("2 years, 7 months");
    expect(tenureText("2025-10-19", "2026-10-19")).toBe("1 year");
    expect(tenureText("2026-05-20", "2026-10-19")).toBe("4 months");
  });

  it("drops to days inside the first month", () => {
    expect(tenureText("2026-10-07", "2026-10-19")).toBe("12 days");
    expect(tenureText("2026-10-18", "2026-10-19")).toBe("1 day");
    expect(tenureText("2026-10-19", "2026-10-19")).toBe("less than a day");
  });

  it("does not round a part month up", () => {
    expect(tenureText("2026-09-20", "2026-10-19")).toBe("29 days");
  });

  it("builds the started line, and copes with a start date in the future", () => {
    expect(startedLine("2024-03-12", "2026-10-19", "Tinas Travel Deals")).toBe("Started 12 Mar 2024 · 2 years, 7 months with Tinas Travel Deals");
    expect(startedLine("2026-11-02", "2026-10-19", "Tinas Travel Deals")).toBe("Starts 2 Nov 2026 with Tinas Travel Deals");
  });
});

import { describe, expect, it } from "vitest";
import type { AgentProfileMonthly } from "../types";
import { buildProfileChart, sharePct } from "./chart-model";
import { buildEarningsTiles } from "./earnings-model";
import { makeHeader, makePerformance } from "./__fixtures__/agent-profile.fixtures";

function monthly(over: Partial<AgentProfileMonthly> = {}): AgentProfileMonthly {
  const keys = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`);
  const profit = [1000, 0, 500, 0, 0, 0, 0, 0, 2000, 800, 0, 0];
  return {
    year: 2026,
    currentMonth: 10,
    months: keys.map((month, i) => ({ month, profit: profit[i] })),
    comparator: { scope: "organisation", label: "Tinas", months: keys.map((month) => ({ month, profit: 4000 })) },
    targets: [800, 0, 0, 0, 0, 0, 0, 0, 2500, 800, 800, 800],
    ...over,
  };
}

describe("sharePct", () => {
  it("rounds and refuses to divide by nothing", () => {
    expect(sharePct(1000, 4000)).toBe(25);
    expect(sharePct(1, 3)).toBe(33);
    expect(sharePct(500, 0)).toBeNull();
  });
});

describe("buildProfileChart", () => {
  it("empties months after the current London month", () => {
    const m = buildProfileChart(monthly(), []);
    const nov = m.months[10];
    expect(nov).toMatchObject({ upcoming: true, hasBar: false, commission: 0, commissionText: "Not yet" });
    expect(m.rows[10]).toMatchObject({ profitText: "—", shareText: "—" });
    expect(m.months[9]).toMatchObject({ upcoming: false, hasBar: true, commission: 800 });
  });

  it("colours against the month target", () => {
    const m = buildProfileChart(monthly(), []);
    expect(m.months[0].kind).toBe("on");
    expect(m.months[8].kind).toBe("under");
    expect(m.months[1].kind).toBe("none");
    expect(m.months[1].hasBar).toBe(false);
  });

  it("shades the months of the selected period and says so in the tooltip", () => {
    const m = buildProfileChart(monthly(), ["2026-09", "2026-10"]);
    expect(m.rows.filter((r) => r.shaded).map((r) => r.month)).toEqual(["2026-09", "2026-10"]);
    expect(m.months[9].tooltip).toBe("October so far 2026: £800 profit, 20% of the agency, target £800. In the selected period.");
    expect(m.months[0].tooltip).not.toContain("selected period");
  });

  it("calls the comparator the branch for branch managers", () => {
    const m = buildProfileChart(monthly({ comparator: { scope: "branch", label: "Leeds", months: [{ month: "2026-01", profit: 2000 }] } }), []);
    expect(m.rows[0].shareText).toBe("50%");
    expect(m.months[0].tooltip).toContain("50% of the branch");
    expect(m.rows[2].shareText).toBe("—");
  });

  it("reports whether there is any profit at all", () => {
    expect(buildProfileChart(monthly(), []).hasProfit).toBe(true);
    const zero = monthly();
    zero.months = zero.months.map((p) => ({ ...p, profit: 0 }));
    expect(buildProfileChart(zero, []).hasProfit).toBe(false);
  });
});

describe("buildEarningsTiles", () => {
  it("shows an employee's profit, share of the agency and lifetime profit", () => {
    const t = buildEarningsTiles(makeHeader(), makePerformance());
    expect(t[0]).toEqual({ label: "Profit earned for the company", value: "£2,000", sub: "From 4 bookings" });
    expect(t[1]).toEqual({ label: "Share of agency profit", value: "25%", sub: "Of the agency's £8,000 in this period" });
    expect(t[2]).toEqual({ label: "Earned since they started", value: "£52,000", sub: "Since 12 Mar 2024" });
  });

  it("says the agency made nothing instead of a percentage", () => {
    const t = buildEarningsTiles(makeHeader(), makePerformance({ comparator: { scope: "organisation", label: "x", profit: 0, bookings: 0, sales: 0, avgCommissionRate: null } }));
    expect(t[1]).toMatchObject({ value: "—", sub: "The agency made no profit in this period" });
  });

  it("shows owners and admins the homeworker split", () => {
    const h = makeHeader({
      isHomeworker: true,
      homeworker: { branchId: "b2", branchName: "Home", isActive: true, profitSharePercent: 70 },
    });
    const t = buildEarningsTiles(h, makePerformance({ profit: 1000, bookings: 1 }));
    expect(t[0]).toMatchObject({ label: "Profit booked", value: "£1,000", sub: "From 1 booking" });
    expect(t[1]).toEqual({ label: "Paid out to Tina", value: "£700", sub: "70% of the profit booked" });
    expect(t[2]).toEqual({ label: "Kept by the agency", value: "£300", sub: "30% of the profit booked" });
  });

  it("hides pay from branch managers", () => {
    const h = makeHeader({
      isHomeworker: true,
      homeworker: { branchId: "b2", branchName: "Home", isActive: true, profitSharePercent: null },
      viewer: { isAdmin: false, canSeePay: false, comparatorScope: "branch", comparatorLabel: "Leeds" },
    });
    const t = buildEarningsTiles(h, makePerformance());
    expect(t.map((x) => x.label)).toEqual(["Profit booked", "Share of agency profit", "Pay and payouts"]);
    expect(t[2]).toMatchObject({ value: "Hidden", sub: "Only owners and admins can see pay" });
    expect(JSON.stringify(t)).not.toContain("Paid out");
  });
});

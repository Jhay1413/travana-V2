import { describe, expect, it } from "vitest";
import { makeRow } from "./fixtures";
import { adjacentTab, breadcrumbRoot, tabCounts, tabFromPath, tabPath } from "./tabs";

describe("departure tabs", () => {
  it("maps paths and tabs both ways", () => {
    expect(tabFromPath("/agency/departures")).toBe("tickets");
    expect(tabFromPath("/agency/departures/balances")).toBe("balances");
    expect(tabFromPath("/agency/departures/balances/")).toBe("balances");
    expect(tabPath("tickets")).toBe("/agency/departures");
    expect(tabPath("balances")).toBe("/agency/departures/balances");
  });

  it("wraps around for the arrow keys", () => {
    expect(adjacentTab("tickets")).toBe("balances");
    expect(adjacentTab("balances")).toBe("tickets");
  });

  it("counts not completed trips and not fully paid bookings", () => {
    const rows = [makeRow({ checks: { completed: true, fullyPaid: true } }), makeRow({ checks: { fullyPaid: true } }), makeRow()];
    expect(tabCounts(rows)).toEqual({ tickets: 2, balances: 1 });
  });

  it("uses the manager breadcrumb root for branch managers", () => {
    expect(breadcrumbRoot(true)).toEqual({ label: "Admin Dashboard", href: "/agency/overview" });
    expect(breadcrumbRoot(false)).toEqual({ label: "Dashboard", href: "/branch-overview" });
  });
});

import { describe, expect, it } from "vitest";
import { balanceLabel, commissionLabel, displayWeb, hrefFor, updatedLabel } from "./format";
import { breadcrumbFor, operatorAccess } from "./access";
import { DEFAULT_SORT, filterOperators, nextSort, sortOperators } from "./sort-filter";
import { summarise } from "./summary";
import type { OrgOperatorRow } from "../types";

function row(name: string, rate: string | null, extra: Partial<OrgOperatorRow> = {}): OrgOperatorRow {
  return {
    linkId: `l-${name}`,
    id: `c-${name}`,
    name,
    code: null,
    website: null,
    phone: null,
    logo_url: null,
    username: null,
    hasPassword: false,
    commission_percentage: rate,
    balance_due_weeks: 14,
    is_active: true,
    updated_at: "2026-10-12T09:00:00Z",
    ...extra,
  };
}

describe("filterOperators", () => {
  const rows = [row("TUI", "10", { phone: "0203 451" }), row("Jet2", "9", { website: "https://trade.jet2.com", username: "TTD-01" })];

  it("returns everything for a blank query", () => {
    expect(filterOperators(rows, "  ")).toHaveLength(2);
  });

  it("matches name, phone, website and username in any case", () => {
    expect(filterOperators(rows, "tui").map((r) => r.name)).toEqual(["TUI"]);
    expect(filterOperators(rows, "0203").map((r) => r.name)).toEqual(["TUI"]);
    expect(filterOperators(rows, "JET2.COM").map((r) => r.name)).toEqual(["Jet2"]);
    expect(filterOperators(rows, "ttd").map((r) => r.name)).toEqual(["Jet2"]);
  });
});

describe("sortOperators", () => {
  const rows = [row("b", "9"), row("A", null), row("c", "12.5")];

  it("sorts by name both ways, ignoring case", () => {
    expect(sortOperators(rows, DEFAULT_SORT).map((r) => r.name)).toEqual(["A", "b", "c"]);
    expect(sortOperators(rows, { key: "name", dir: -1 }).map((r) => r.name)).toEqual(["c", "b", "A"]);
  });

  it("sorts by rate with unset rates last either way", () => {
    expect(sortOperators(rows, { key: "commission", dir: 1 }).map((r) => r.name)).toEqual(["b", "c", "A"]);
    expect(sortOperators(rows, { key: "commission", dir: -1 }).map((r) => r.name)).toEqual(["c", "b", "A"]);
  });

  it("does not mutate its input", () => {
    const copy = [...rows];
    sortOperators(rows, { key: "name", dir: -1 });
    expect(rows).toEqual(copy);
  });
});

describe("nextSort", () => {
  it("reverses the same column and starts a new one ascending", () => {
    expect(nextSort({ key: "name", dir: 1 }, "name")).toEqual({ key: "name", dir: -1 });
    expect(nextSort({ key: "name", dir: -1 }, "commission")).toEqual({ key: "commission", dir: 1 });
  });
});

describe("summarise", () => {
  it("averages only the rates that are set", () => {
    const s = summarise([row("a", "10"), row("b", "9.5"), row("c", null)]);
    expect(s).toEqual({ count: 3, average: "9.8", highest: "10%", highestName: "a" });
  });

  it("falls back when nothing is set", () => {
    expect(summarise([])).toEqual({ count: 0, average: "—", highest: "—", highestName: "None yet" });
    expect(summarise([row("a", null)]).average).toBe("—");
  });
});

describe("format", () => {
  it("shows a web address without the scheme", () => {
    expect(displayWeb("https://trade.example.com/")).toBe("trade.example.com");
    expect(displayWeb(null)).toBe("");
    expect(hrefFor("trade.example.com")).toBe("https://trade.example.com");
    expect(hrefFor("http://x.com")).toBe("http://x.com");
  });

  it("writes the updated line in London time", () => {
    expect(updatedLabel("2026-10-12T09:00:00Z")).toBe("Updated Mon 12 Oct");
    expect(updatedLabel("nonsense")).toBe("");
  });

  it("writes weeks and commission", () => {
    expect(balanceLabel(14)).toBe("14 weeks");
    expect(balanceLabel(1)).toBe("1 week");
    expect(commissionLabel("8.50")).toBe("8.5%");
    expect(commissionLabel(null)).toBe("—");
  });
});

describe("access", () => {
  it("lets owners, admins and branch managers write", () => {
    for (const r of ["platform_admin", "org_admin", "branch_manager"] as const) {
      expect(operatorAccess(r)).toEqual({ canWrite: true, canSeePasswords: true });
    }
  });

  it("keeps agents and homeworkers read-only", () => {
    for (const r of ["agent", "homeworker", null] as const) {
      expect(operatorAccess(r)).toEqual({ canWrite: false, canSeePasswords: false });
    }
  });

  it("picks the breadcrumb root per role", () => {
    expect(breadcrumbFor("org_admin")).toEqual({ label: "Admin Dashboard", href: "/agency/overview" });
    expect(breadcrumbFor("branch_manager")).toEqual({ label: "Dashboard", href: "/branch-overview" });
    expect(breadcrumbFor("agent")).toEqual({ label: "Home", href: "/agent-overview" });
  });
});

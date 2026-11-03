import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  applyNonStatusFilters,
  branchChoices,
  filterInvites,
  filterMembers,
  hasActiveFilters,
  matchesQuery,
  statusCounts,
} from "./member-filters";
import { makeMember } from "./member-fixtures";

const sam = makeMember({ id: "1", name: "Sam Rivers", email: "sam@x.com", orgRole: "agent" });
const tina = makeMember({
  id: "2",
  name: "Tina Love",
  email: "tina@x.com",
  orgRole: "branch_manager",
  branches: [{ branchId: "b2", branchName: "Leeds", orgRole: "branch_manager", isActive: true }],
});
const rob = makeMember({
  id: "3",
  name: "Rob Hargreaves",
  email: "rob@x.com",
  orgRole: "agent",
  banned: true,
});
const all = [sam, tina, rob];

describe("member-filters", () => {
  it("splits by status tab", () => {
    expect(filterMembers(all, DEFAULT_FILTERS).map((m) => m.user.id)).toEqual(["1", "2"]);
    expect(filterMembers(all, { ...DEFAULT_FILTERS, status: "suspended" }).map((m) => m.user.id)).toEqual(["3"]);
  });

  it("filters by role and branch", () => {
    expect(filterMembers(all, { ...DEFAULT_FILTERS, role: "branch_manager" }).map((m) => m.user.id)).toEqual(["2"]);
    expect(filterMembers(all, { ...DEFAULT_FILTERS, branchId: "b2" }).map((m) => m.user.id)).toEqual(["2"]);
  });

  it("searches name, email, branch and role label", () => {
    expect(matchesQuery(sam, "RIVERS")).toBe(true);
    expect(matchesQuery(sam, "sam@x")).toBe(true);
    expect(matchesQuery(tina, "leeds")).toBe(true);
    expect(matchesQuery(tina, "branch manager")).toBe(true);
    expect(matchesQuery(tina, "zzz")).toBe(false);
    expect(matchesQuery(tina, "   ")).toBe(true);
  });

  it("counts statuses across the roster", () => {
    expect(statusCounts(all)).toEqual({ active: 2, suspended: 1 });
    expect(statusCounts([])).toEqual({ active: 0, suspended: 0 });
  });

  it("keeps suspended people when only non-status filters apply", () => {
    expect(applyNonStatusFilters(all, { ...DEFAULT_FILTERS, role: "agent" }).map((m) => m.user.id)).toEqual(["1", "3"]);
  });

  it("knows when a filter is on", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, query: "x" })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, status: "suspended" })).toBe(false);
  });
});

describe("invites and branch choices", () => {
  const invites = [
    { email: "new@x.com", orgRole: "agent", branchId: "b1", branchName: "Main" },
    { email: "lead@x.com", orgRole: "branch_manager", branchId: "b2", branchName: "Leeds" },
  ];

  it("shows pending invites on the Active tab only", () => {
    expect(filterInvites(invites, DEFAULT_FILTERS)).toHaveLength(2);
    expect(filterInvites(invites, { ...DEFAULT_FILTERS, status: "suspended" })).toHaveLength(0);
  });

  it("applies role, branch and search to invites", () => {
    expect(filterInvites(invites, { ...DEFAULT_FILTERS, role: "agent" }).map((i) => i.email)).toEqual(["new@x.com"]);
    expect(filterInvites(invites, { ...DEFAULT_FILTERS, branchId: "b2" }).map((i) => i.email)).toEqual(["lead@x.com"]);
    expect(filterInvites(invites, { ...DEFAULT_FILTERS, query: "LEEDS" }).map((i) => i.email)).toEqual(["lead@x.com"]);
  });

  it("lists distinct branches sorted by name", () => {
    expect(branchChoices(all).map((b) => b.name)).toEqual(["Leeds", "Main"]);
  });
});

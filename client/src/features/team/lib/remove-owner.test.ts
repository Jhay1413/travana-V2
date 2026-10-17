import { describe, expect, it } from "vitest";
import { makeMember } from "./member-fixtures";
import { defaultNewOwner, eligibleNewOwners, isRemoveConfirmed, needsNewOwner, workloadSummary } from "./remove-owner";

const branchA = { branchId: "a", branchName: "A", orgRole: "agent", isActive: true };
const branchB = { branchId: "b", branchName: "B", orgRole: "agent", isActive: true };

const removed = makeMember({ id: "gone", orgRole: "agent", branches: [branchA] });
const mgrA = makeMember({ id: "mgrA", orgRole: "branch_manager", branches: [branchA] });
const mgrB = makeMember({ id: "mgrB", orgRole: "branch_manager", branches: [branchB] });
const admin = makeMember({ id: "adm", orgRole: "org_admin", branches: [branchB] });
const homeworker = makeMember({ id: "hw", orgRole: "homeworker", branches: [branchA] });
const social = makeMember({ id: "sm", orgRole: "social_media_manager", branches: [branchA] });
const banned = makeMember({ id: "ban", orgRole: "agent", banned: true, branches: [branchA] });
const idle = makeMember({
  id: "idle",
  orgRole: "agent",
  branches: [{ ...branchA, isActive: false }],
});

describe("remove-owner", () => {
  it("needs a new owner when anything is assigned", () => {
    expect(needsNewOwner({ openDeals: 0, openTasks: 0, openTickets: 0, clients: 0 })).toBe(false);
    expect(needsNewOwner({ openDeals: 0, openTasks: 0, openTickets: 0, clients: 2 })).toBe(true);
    expect(needsNewOwner({ openDeals: 1, openTasks: 0, openTickets: 0, clients: 0 })).toBe(true);
  });

  it("offers only active admins, branch managers and agents, not the removed person", () => {
    const ids = eligibleNewOwners([removed, mgrA, mgrB, admin, homeworker, social, banned, idle], "gone").map((m) => m.user.id);
    expect(ids).toEqual(["mgrA", "mgrB", "adm"]);
  });

  it("prefers the branch manager of the removed user's branch", () => {
    expect(defaultNewOwner([removed, admin, mgrB, mgrA], removed)).toBe("mgrA");
  });

  it("falls back to the first eligible person, or empty when nobody can", () => {
    expect(defaultNewOwner([removed, admin, mgrB], removed)).toBe("adm");
    expect(defaultNewOwner([removed, homeworker], removed)).toBe("");
  });

  it("accepts REMOVE typed in any case", () => {
    expect(isRemoveConfirmed("REMOVE")).toBe(true);
    expect(isRemoveConfirmed("  remove ")).toBe(true);
    expect(isRemoveConfirmed("remov")).toBe(false);
    expect(isRemoveConfirmed("")).toBe(false);
  });

  it("summarises work with correct plurals and skips zeros", () => {
    expect(workloadSummary({ openDeals: 1, openTasks: 0, openTickets: 2, clients: 3 })).toBe(
      "1 open deal, 2 open tickets, 3 clients",
    );
    expect(workloadSummary({ openDeals: 0, openTasks: 0, openTickets: 0, clients: 0 })).toBe("");
  });
});

describe("default owner for a suspended person", () => {
  it("falls back to all of their branches when none are active", () => {
    const gone = makeMember({ id: "g", orgRole: "agent", banned: true, branches: [{ ...branchA, isActive: false }] });
    expect(defaultNewOwner([gone, admin, mgrA], gone)).toBe("mgrA");
  });
});

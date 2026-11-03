import { describe, it, expect, vi, beforeEach } from "vitest";
import { userOrgRoles, branchMembers, user } from "@shared/schema";

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return { ...actual, notInArray: vi.fn(actual.notInArray) };
});

// tx query-builder stub: records every update/delete so tests can assert on
// which table + values/conditions setOrgRoleAtomic issued inside the transaction.
const updateCalls: Array<{ table: unknown; values: unknown }> = [];
const deleteCalls: Array<{ table: unknown }> = [];
const insertCalls: Array<{ table: unknown; values: unknown; conflict?: unknown }> = [];

function makeTx() {
  return {
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: unknown) => {
        updateCalls.push({ table, values });
        return { where: vi.fn(() => Promise.resolve()) };
      }),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((values: unknown) => {
        const call: { table: unknown; values: unknown; conflict?: unknown } = { table, values };
        insertCalls.push(call);
        return {
          onConflictDoNothing: vi.fn((cfg: unknown) => {
            call.conflict = cfg;
            return Promise.resolve();
          }),
        };
      }),
    })),
    delete: vi.fn((table: unknown) => {
      deleteCalls.push({ table });
      return { where: vi.fn(() => Promise.resolve()) };
    }),
  };
}

vi.mock("../../config/database", () => ({
  db: {
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<void>) => cb(makeTx())),
  },
}));

import { branchMemberRepository } from "./branch-member.repository";
import { notInArray } from "drizzle-orm";

beforeEach(() => {
  vi.clearAllMocks();
  updateCalls.length = 0;
  deleteCalls.length = 0;
  insertCalls.length = 0;
});

describe("branchMemberRepository.setOrgRoleAtomic", () => {
  it("updates user.orgRole and branch_members.orgRole to the new role", async () => {
    await branchMemberRepository.setOrgRoleAtomic("o1", "u1", "org_admin");

    expect(updateCalls).toEqual([
      { table: user, values: expect.objectContaining({ orgRole: "org_admin" }) },
      { table: branchMembers, values: { orgRole: "org_admin" } },
    ]);
  });

  it("deletes stale user_org_roles rows, keeping the new role and 'agent'", async () => {
    await branchMemberRepository.setOrgRoleAtomic("o1", "u1", "org_admin");

    expect(deleteCalls).toEqual([{ table: userOrgRoles }]);
    expect(vi.mocked(notInArray)).toHaveBeenCalledWith(userOrgRoles.role, ["org_admin", "agent"]);
  });

  it("also drops the 'agent' row when the new role is referral_agent", async () => {
    await branchMemberRepository.setOrgRoleAtomic("o1", "u1", "referral_agent");

    expect(vi.mocked(notInArray)).toHaveBeenCalledWith(userOrgRoles.role, ["referral_agent"]);
  });

  it("upserts a user_org_roles row for the new role (no-op on conflict)", async () => {
    await branchMemberRepository.setOrgRoleAtomic("o1", "u1", "homeworker");

    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].table).toBe(userOrgRoles);
    expect(insertCalls[0].values).toEqual({ userId: "u1", orgId: "o1", role: "homeworker" });
    expect(insertCalls[0].conflict).toBeDefined();
  });

  it("keeps only 'homeworker' (not 'agent') when the new role is homeworker", async () => {
    await branchMemberRepository.setOrgRoleAtomic("o1", "u1", "homeworker");

    expect(vi.mocked(notInArray)).toHaveBeenCalledWith(userOrgRoles.role, ["homeworker"]);
  });

  it("de-dupes the keep-list when the new role is 'agent' itself", async () => {
    await branchMemberRepository.setOrgRoleAtomic("o1", "u1", "agent");

    expect(vi.mocked(notInArray)).toHaveBeenCalledWith(userOrgRoles.role, ["agent"]);
  });
});

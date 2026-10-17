import { describe, it, expect, vi, beforeEach } from "vitest";
import { branches, branchMembers, hrRecordsTable, user, userOrgRoles } from "@shared/schema";

type Op = { op: "insert" | "update"; table: unknown; values: unknown };
const ops: Op[] = [];

function makeTx() {
  return {
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((values: unknown) => {
        ops.push({ op: "insert", table, values });
        const rows = table === user ? [{ id: "u-new", ...(values as object) }] : [{ id: "hb-new", organizationId: "o1", ...(values as object) }];
        return Object.assign(Promise.resolve(), {
          returning: vi.fn(() => Promise.resolve(rows)),
          onConflictDoNothing: vi.fn(() => Promise.resolve()),
        });
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: unknown) => {
        ops.push({ op: "update", table, values });
        return {
          where: vi.fn(() =>
            Object.assign(Promise.resolve(), {
              returning: vi.fn(() => Promise.resolve(table === branches ? [{ id: "hb1", ownerUserId: "hw1" }] : [])),
            }),
          ),
        };
      }),
    })),
  };
}

const setActiveForUser = vi.hoisted(() => vi.fn());

vi.mock("../../config/database", () => ({
  db: { transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(makeTx())) },
}));
vi.mock("../branch-member/branch-member.repository", () => ({
  branchMemberRepository: { setActiveForUser },
}));

import { homeworkerRepository } from "./homeworker.repository";

beforeEach(() => {
  vi.clearAllMocks();
  ops.length = 0;
});

describe("homeworkerRepository.createHomeworkerAtomic", () => {
  it("inserts user, branch, membership, role and HR record in that order inside one transaction", async () => {
    const result = await homeworkerRepository.createHomeworkerAtomic({
      userValues: { id: "u-new", email: "a@b.com", orgRole: "homeworker", orgId: "o1" } as never,
      branchValues: {
        organizationId: "o1",
        name: "a",
        branchType: "homeworker",
        isDefault: false,
        isActive: true,
        profitSharePercent: "40",
      } as never,
    });

    expect(ops.map((o) => o.table)).toEqual([user, branches, branchMembers, userOrgRoles, hrRecordsTable]);
    expect(result.user.id).toBe("u-new");
    expect(result.branch.id).toBe("hb-new");
  });

  it("wires the new user as branch owner and creates an inactive homeworker membership", async () => {
    await homeworkerRepository.createHomeworkerAtomic({
      userValues: { id: "u-new", email: "a@b.com" } as never,
      branchValues: { organizationId: "o1", name: "a", branchType: "homeworker", isDefault: false, isActive: true } as never,
    });

    expect(ops[1].values).toMatchObject({ ownerUserId: "u-new", branchType: "homeworker", isDefault: false, isActive: true });
    expect(ops[2].values).toMatchObject({ branchId: "hb-new", userId: "u-new", orgRole: "homeworker", isActive: false, orgId: "o1" });
    expect(ops[3].values).toMatchObject({ userId: "u-new", orgId: "o1", role: "homeworker" });
    expect(ops[4].values).toMatchObject({ userId: "u-new", orgId: "o1" });
  });
});

describe("homeworkerRepository.archiveAtomic", () => {
  it("deactivates the branch and suspends the owner via the member repository, deleting nothing", async () => {
    const result = await homeworkerRepository.archiveAtomic("hb1", "o1");

    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ op: "update", table: branches, values: { isActive: false } });
    expect(setActiveForUser).toHaveBeenCalledWith("o1", "hw1", false, expect.anything());
    expect(result).toMatchObject({ id: "hb1" });
  });
});

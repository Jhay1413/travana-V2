import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

vi.mock("../../utils/user-conditions", async () => {
  const { sql } = await import("drizzle-orm");
  return { notSuspendedOrBanned: () => sql`1 = 1` };
});

import { userRepository } from "./user.repository";
import { resetCapture, renderWhere, setRows, whereCalls } from "../../test/capture-db";
import type { Scope } from "../../utils/scope";

const BASE: Scope = {
  orgId: "org1",
  branchId: "b1",
  orgRole: "agent",
  orgRoles: ["agent"],
  userId: "u1",
  branchType: "shop",
  ownsHomeworkerBranch: false,
};

beforeEach(() => resetCapture());

describe("userRepository.findAll partition (non-admin branch path)", () => {
  it("hides homeworker-branch users from shop staff", async () => {
    setRows([{ userId: "u1" }]);
    await userRepository.findAll(BASE);
    const final = renderWhere(whereCalls.length - 1);
    expect(final.text).toContain("NOT IN (SELECT");
    expect(final.text).toContain("'homeworker'");
  });

  it("limits a homeworker to themselves", async () => {
    setRows([{ userId: "hw" }]);
    await userRepository.findAll({ ...BASE, orgRole: "homeworker", orgRoles: ["homeworker"], userId: "hw", branchType: "homeworker" });
    const final = renderWhere(whereCalls.length - 1);
    expect(final.params).toContain("hw");
    expect(final.text).not.toContain("NOT IN (SELECT");
  });

  it("returns an empty list without a branch", async () => {
    expect(await userRepository.findAll({ ...BASE, branchId: null })).toEqual([]);
  });

  it("does not partition for org_admin", async () => {
    await userRepository.findAll({ ...BASE, orgRole: "org_admin", orgRoles: ["org_admin"] });
    expect(renderWhere(0).text).not.toContain("NOT IN (SELECT");
  });
});

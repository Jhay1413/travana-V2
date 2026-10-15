import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { searchRepository } from "./search.repository";
import { resetCapture, renderWhere, whereCalls } from "../../test/capture-db";
import type { Scope } from "../../utils/scope";

const AGENT: Scope = {
  orgId: "org1",
  branchId: "b1",
  orgRole: "agent",
  orgRoles: ["agent"],
  userId: "u1",
  branchType: "shop",
  ownsHomeworkerBranch: false,
};

const OWN_HOMEWORKER: Scope = {
  ...AGENT,
  orgRole: "homeworker",
  orgRoles: ["homeworker"],
  branchId: "hw1",
  branchType: "homeworker",
  ownsHomeworkerBranch: true,
};

beforeEach(() => resetCapture());

describe("searchRepository.globalSearch partition", () => {
  it("excludes homeworker branches from both the client and booking queries for shop staff", async () => {
    await searchRepository.globalSearch("ada", { orgId: "org1", scope: AGENT });
    expect(whereCalls).toHaveLength(2);
    expect(renderWhere(0).text).toContain('"client_table"."branch_id" NOT IN (SELECT');
    expect(renderWhere(1).text).toContain('"transaction"."branch_id" NOT IN (SELECT');
  });

  it("confines an own-branch homeworker to their branch and own rows on both queries", async () => {
    await searchRepository.globalSearch("ada", { orgId: "org1", scope: OWN_HOMEWORKER });
    expect(renderWhere(0).params).toEqual(expect.arrayContaining(["hw1", "u1"]));
    expect(renderWhere(1).params).toEqual(expect.arrayContaining(["hw1", "u1"]));
  });

  it("adds no partition for org_admin", async () => {
    await searchRepository.globalSearch("ada", {
      orgId: "org1",
      scope: { ...AGENT, orgRole: "org_admin", orgRoles: ["org_admin"] },
    });
    expect(renderWhere(0).text).not.toContain("NOT IN (SELECT");
  });
});

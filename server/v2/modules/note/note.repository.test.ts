import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { noteRepository } from "./note.repository";
import { resetCapture, renderWhere, setRows } from "../../test/capture-db";
import type { Scope } from "../../utils/scope";

const SHOP_AGENT: Scope = {
  orgId: "org1",
  branchId: "b1",
  orgRole: "agent",
  orgRoles: ["agent"],
  userId: "u1",
  branchType: "shop",
  ownsHomeworkerBranch: false,
};

const OWN_HOMEWORKER: Scope = {
  ...SHOP_AGENT,
  orgRole: "homeworker",
  orgRoles: ["homeworker"],
  branchId: "hw1",
  userId: "hw",
  branchType: "homeworker",
  ownsHomeworkerBranch: true,
};

beforeEach(() => resetCapture());

describe("noteRepository partition conditions", () => {
  it("transactionBelongsToOrg hides homeworker branches from shop staff", async () => {
    await noteRepository.transactionBelongsToOrg("t1", "org1", SHOP_AGENT);
    expect(renderWhere(0).text).toContain('"transaction"."branch_id" NOT IN (SELECT');
  });

  it("transactionBelongsToOrg pins an own-branch homeworker to their branch and rows", async () => {
    setRows([{ id: "t1" }]);
    expect(await noteRepository.transactionBelongsToOrg("t1", "org1", OWN_HOMEWORKER)).toBe(true);
    expect(renderWhere(0).params).toEqual(expect.arrayContaining(["hw1", "hw"]));
  });

  it("clientBelongsToOrg hides homeworker clients from shop staff", async () => {
    await noteRepository.clientBelongsToOrg("c1", "org1", SHOP_AGENT);
    expect(renderWhere(0).text).toContain('"client_table"."branch_id" NOT IN (SELECT');
  });

  it("clientBelongsToOrg pins an own-branch homeworker to their branch and clients", async () => {
    await noteRepository.clientBelongsToOrg("c1", "org1", OWN_HOMEWORKER);
    expect(renderWhere(0).params).toEqual(expect.arrayContaining(["hw1", "hw"]));
  });

  it("without a scope the checks stay org-only", async () => {
    await noteRepository.transactionBelongsToOrg("t1", "org1");
    await noteRepository.clientBelongsToOrg("c1", "org1");
    expect(renderWhere(0).text).not.toContain("NOT IN (SELECT");
    expect(renderWhere(1).text).not.toContain("NOT IN (SELECT");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { branchMemberRepository } from "./branch-member.repository";
import { resetCapture, renderWhere, renderOrderBy, setRows } from "../../test/capture-db";

beforeEach(() => resetCapture());

describe("branchMemberRepository.findActiveContextByUserId", () => {
  it("filters on an active membership in an active branch", async () => {
    await branchMemberRepository.findActiveContextByUserId("u1");
    const r = renderWhere(0);
    expect(r.text).toContain('"branch_members"."user_id" = $1');
    expect(r.text).toContain('"branch_members"."is_active" = $2');
    expect(r.text).toContain('"branches"."is_active" = $3');
    expect(r.text).not.toContain('"branch_members"."org_id"');
  });

  it("orders the owner's own branch first, then joined_at, then id", async () => {
    await branchMemberRepository.findActiveContextByUserId("u1");
    const order = renderOrderBy(0);
    expect(order).toContain('CASE WHEN "branches"."owner_user_id" = $1 THEN 0 ELSE 1 END');
    expect(order.indexOf("owner_user_id")).toBeLessThan(order.indexOf("joined_at"));
    expect(order.indexOf("joined_at")).toBeLessThan(order.lastIndexOf("\"id\""));
  });

  it("returns the first row", async () => {
    setRows([{ branchId: "b1", branchType: "homeworker", ownerUserId: "u1" }]);
    expect(await branchMemberRepository.findActiveContextByUserId("u1")).toMatchObject({ branchId: "b1" });
  });

  it("the InOrg variant adds the org filter", async () => {
    await branchMemberRepository.findActiveContextByUserIdInOrg("u1", "org1");
    const r = renderWhere(0);
    expect(r.text).toContain('"branch_members"."org_id"');
    expect(r.params).toContain("org1");
  });
});

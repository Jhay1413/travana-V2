import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});
vi.mock("../user-org-roles/user-org-roles.repository", () => ({
  userOrgRolesRepository: {
    findSocialOnlyUserIds: vi.fn().mockResolvedValue([]),
    findSuspendedUserIds: vi.fn().mockResolvedValue(new Set()),
  },
}));

import { reportsRepository } from "./reports.repository";
import { resetCapture, renderWhere, whereCalls } from "../../test/capture-db";
import type { Scope } from "../../utils/scope";

const BM: Scope = {
  orgId: "org1",
  branchId: null,
  orgRole: "branch_manager",
  orgRoles: ["branch_manager"],
  userId: "u1",
  branchType: null,
  ownsHomeworkerBranch: false,
};

const range = { from: new Date("2026-01-01"), to: new Date("2026-02-01") };

beforeEach(() => resetCapture());

describe("reportsRepository partition", () => {
  it("getSales excludes homeworker branches for a branch-less branch_manager", async () => {
    await reportsRepository.getSales({ orgId: "org1", branchId: null, partitionScope: BM, ...range }).catch(() => undefined);
    const texts = whereCalls.map((_, i) => renderWhere(i).text);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.every((t) => t.includes('"transaction"."branch_id" NOT IN (SELECT'))).toBe(true);
  });

  it("getSales adds no exclusion for an org_admin", async () => {
    await reportsRepository
      .getSales({ orgId: "org1", branchId: null, partitionScope: { ...BM, orgRole: "org_admin", orgRoles: ["org_admin"] }, ...range })
      .catch(() => undefined);
    const texts = whereCalls.map((_, i) => renderWhere(i).text);
    expect(texts.some((t) => t.includes("NOT IN (SELECT"))).toBe(false);
  });

  it("getLeadSource carries the exclusion on its enquiry, quote and booking queries", async () => {
    await reportsRepository.getLeadSource({ orgId: "org1", branchId: null, partitionScope: BM, ...range }).catch(() => undefined);
    const texts = whereCalls.map((_, i) => renderWhere(i).text);
    expect(texts.length).toBeGreaterThanOrEqual(3);
    expect(texts.every((t) => t.includes("NOT IN (SELECT"))).toBe(true);
  });
});

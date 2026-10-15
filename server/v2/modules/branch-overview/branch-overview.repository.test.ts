import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { branchOverviewRepository } from "./branch-overview.repository";
import { resetCapture, renderWhere, whereCalls } from "../../test/capture-db";
import type { Scope } from "../../utils/scope";

const BM: Scope = {
  orgId: "org1", branchId: null, orgRole: "branch_manager", orgRoles: ["branch_manager"],
  userId: "u1", branchType: null, ownsHomeworkerBranch: false,
};

beforeEach(() => resetCapture());

describe("branchOverviewRepository.getStats partition", () => {
  it("adds the homeworker-branch exclusion when given a partitionScope", async () => {
    await branchOverviewRepository.getStats({ orgId: "org1", branchId: null, partitionScope: BM }).catch(() => undefined);
    const texts = whereCalls.map((_, i) => renderWhere(i).text);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.some((t) => t.includes('"transaction"."branch_id" NOT IN (SELECT'))).toBe(true);
  });

  it("adds none for an org_admin", async () => {
    await branchOverviewRepository
      .getStats({ orgId: "org1", branchId: null, partitionScope: { ...BM, orgRole: "org_admin", orgRoles: ["org_admin"] } })
      .catch(() => undefined);
    expect(whereCalls.map((_, i) => renderWhere(i).text).some((t) => t.includes("NOT IN (SELECT"))).toBe(false);
  });
});

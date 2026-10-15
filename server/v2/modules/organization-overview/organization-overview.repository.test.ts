import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});
vi.mock("../user-org-roles/user-org-roles.repository", () => ({ userOrgRolesRepository: {} }));

import { organizationOverviewRepository } from "./organization-overview.repository";
import { resetCapture, renderWhere, setRows } from "../../test/capture-db";

beforeEach(() => resetCapture());

const WHEN = new Date("2026-01-15T12:00:00Z");

describe("organizationOverviewRepository.getHomeworkerBranches", () => {
  it("only returns owned homeworker branches (never the legacy shared branch)", async () => {
    await organizationOverviewRepository.getHomeworkerBranches("o1");

    const { text, params } = renderWhere(0);
    expect(text).toContain('"branches"."branch_type" = ');
    expect(text).toContain('"branches"."owner_user_id" is not null');
    expect(params).toEqual(expect.arrayContaining(["homeworker", "o1"]));
  });

  it("maps rows into records with a numeric profit share", async () => {
    setRows([
      {
        branchId: "hb1", name: "H", ownerUserId: "u1", ownerFirstName: "Ann", ownerLastName: "Lee",
        ownerName: null, ownerEmail: "a@x", ownerImage: null, profitSharePercent: "62.50", isActive: false,
      },
    ]);

    const [rec] = await organizationOverviewRepository.getHomeworkerBranches("o1");

    expect(rec).toMatchObject({ ownerName: "Ann Lee", profitSharePercent: 62.5, isActive: false, ownerAvatarUrl: null });
  });
});

describe("organizationOverviewRepository org-wide targets", () => {
  it("monthly target sums shop targets (shop branches) and homeworker agent targets", async () => {
    setRows([{ total: "1000" }]);

    const total = await organizationOverviewRepository.getOrgMonthlyTarget("o1", WHEN);

    expect(total).toBe(2000); // both parts summed (capture-db returns the same row for each query)
    const shop = renderWhere(0);
    const hw = renderWhere(1);
    expect(shop.text).toContain('"branches"."branch_type" <> ');
    expect(hw.text).toContain('"branches"."branch_type" = ');
    expect(hw.text).toContain('"agent_target_table"');
  });

  it("yearly series merges both parts per month", async () => {
    setRows([{ month: 1, total: "300" }]);

    const map = await organizationOverviewRepository.getOrgYearlyTargets("o1", 2026);

    expect(map.get(1)).toBe(600);
    expect(renderWhere(0).text).toContain('"shop_target_table"');
    expect(renderWhere(1).text).toContain('"agent_target_table"');
  });

  it("returns zero without an org", async () => {
    expect(await organizationOverviewRepository.getOrgMonthlyTarget(null, WHEN)).toBe(0);
    expect((await organizationOverviewRepository.getOrgYearlyTargets(null, 2026)).size).toBe(0);
  });
});

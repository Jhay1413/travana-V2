import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});
vi.mock("../user-org-roles/user-org-roles.repository", () => ({
  userOrgRolesRepository: { findSocialOnlyUserIds: vi.fn().mockResolvedValue(["social1"]) },
}));

import * as targetsRepository from "./targets.repository";
import { captureDb, resetCapture, renderWhere, setRows, whereCalls } from "../../test/capture-db";

beforeEach(() => resetCapture());

const exec = captureDb as unknown as targetsRepository.TargetsExecutor;

describe("targetsRepository.upsertOrgTargets - £0 means not set", () => {
  it("deletes the months sent as 0 and stores only months above 0", async () => {
    await targetsRepository.upsertOrgTargets(exec, "o1", 2026, [1000, 0, 0, 500, ...new Array<number>(8).fill(0)]);

    expect(whereCalls).toHaveLength(1); // the delete; the insert has no where
    const del = renderWhere(0);
    expect(del.text).toContain('"org_target_table"');
    expect(del.params).toEqual(expect.arrayContaining(["o1", 2026, 2, 3]));
    expect(del.params).not.toContain(1);
  });

  it("an all-zero year only deletes", async () => {
    await targetsRepository.upsertOrgTargets(exec, "o1", 2026, new Array<number>(12).fill(0));
    expect(whereCalls).toHaveLength(1);
  });

  it("nothing to delete when every month is above 0", async () => {
    await targetsRepository.upsertOrgTargets(exec, "o1", 2026, new Array<number>(12).fill(5));
    expect(whereCalls).toHaveLength(0);
  });
});

describe("targetsRepository reads ignore £0 rows and fail closed", () => {
  it("getOrgTargetsForYear only returns months above 0", async () => {
    setRows([]);
    await targetsRepository.getOrgTargetsForYear("o1", 2026);
    expect(renderWhere(0).text).toContain('"org_target_table"."target_amount" > ');
  });

  it("an empty userId filters to nothing instead of to everyone", async () => {
    await targetsRepository.getAgentTargetRowsForYear(["b1"], 2026, "");
    expect(renderWhere(0).text).toContain('"agent_target_table"."user_id" = ');

    resetCapture();
    await targetsRepository.listMembers("o1", ["b1"], "");
    expect(renderWhere(0).text).toContain('"branch_members"."user_id" = ');

    resetCapture();
    await targetsRepository.getActualsForYear("o1", 2026, { userId: "" });
    expect(renderWhere(0).text).toContain('"transaction"."user_id" = ');
  });
});

describe("targetsRepository.getMemberUserIds", () => {
  it("excludes social-only managers like the year view does", async () => {
    setRows([{ userId: "a1" }, { userId: "social1" }]);
    const ids = await targetsRepository.getMemberUserIds("b1", ["a1", "social1"]);
    expect(Array.from(ids)).toEqual(["a1"]);
  });
});

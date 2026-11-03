import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { onboardingSetupRepository } from "./onboarding-setup.repository";
import { resetCapture, renderWhere, setRows, whereCalls } from "../../test/capture-db";

beforeEach(() => resetCapture());

describe("onboardingSetupRepository.hasTargetForMonth", () => {
  it("also counts the stored business target for the month", async () => {
    setRows([]);

    expect(await onboardingSetupRepository.hasTargetForMonth("o1", 2026, 10)).toBe(false);

    expect(whereCalls).toHaveLength(3);
    const business = renderWhere(2);
    expect(business.text).toContain('"org_target_table"');
    expect(business.params).toEqual(expect.arrayContaining(["o1", 2026, 10]));
  });

  it("is true when any target row exists", async () => {
    setRows([{ id: "t1" }]);
    expect(await onboardingSetupRepository.hasTargetForMonth("o1", 2026, 10)).toBe(true);
  });
});

describe("onboardingSetupRepository.hasTargetForMonth ignores £0 business rows", () => {
  it("only counts a stored business target above 0", async () => {
    setRows([]);
    await onboardingSetupRepository.hasTargetForMonth("o1", 2026, 10);
    expect(renderWhere(2).text).toContain('"org_target_table"."target_amount" > ');
  });
});

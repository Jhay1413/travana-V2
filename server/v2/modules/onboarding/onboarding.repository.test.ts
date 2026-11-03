import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
const tx = {
  insert: vi.fn(() => ({
    values: vi.fn(() => {
      calls.push("insert");
      return {
        returning: vi.fn(async () => [{ id: "new-id" }]),
        onConflictDoNothing: vi.fn(async () => undefined),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(undefined).then(resolve),
      };
    }),
  })),
};

vi.mock("../../config/database", () => ({
  db: { transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) },
}));
vi.mock("../organization/organization.repository", () => ({
  organizationRepository: { mergeSettingsSection: vi.fn(async () => undefined) },
}));
vi.mock("../tour-operator/org-tour-operator.repository", () => ({
  orgTourOperatorRepository: {
    linkSeedOperators: vi.fn(async () => {
      calls.push("link");
      return 3;
    }),
  },
}));

import { onboardingRepository } from "./onboarding.repository";
import { orgTourOperatorRepository } from "../tour-operator/org-tour-operator.repository";
import { tourOperatorCommissionSeed } from "@shared/tour-operator-seed";

beforeEach(() => {
  calls.length = 0;
});

describe("onboardingRepository.signupAgency", () => {
  it("links the new org to the SEED operators at their seed commission inside the signup transaction", async () => {
    const result = await onboardingRepository.signupAgency({
      organization: { name: "Acme" } as never,
      branchInput: { name: "Main" } as never,
      ownerUser: { email: "a@b.c" } as never,
      ownerBranchMemberRoleAndActive: { orgRole: "admin", isActive: true },
    });

    expect(result.orgId).toBe("new-id");
    expect(orgTourOperatorRepository.linkSeedOperators).toHaveBeenCalledWith("new-id", tourOperatorCommissionSeed, null, tx);
    expect(tourOperatorCommissionSeed.every((s) => s.commission_percentage !== "")).toBe(true);
    // Right after the organization insert, before the branch insert.
    expect(calls.slice(0, 3)).toEqual(["insert", "link", "insert"]);
  });
});

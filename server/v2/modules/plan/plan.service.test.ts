import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./plan.repository", () => ({ planRepository: { findByOrg: vi.fn(), findByCode: vi.fn() } }));
vi.mock("../branch/branch.repository", () => ({ branchRepository: { countByOrg: vi.fn() } }));

import { planService } from "./plan.service";
import { planRepository } from "./plan.repository";
import { branchRepository } from "../branch/branch.repository";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(planRepository.findByOrg).mockResolvedValue({ code: "starter", branchLimit: 2 } as never);
});

describe("planService.assertCanAddBranch", () => {
  it("refuses at the limit with 403 and the BRANCH_LIMIT_REACHED code", async () => {
    vi.mocked(branchRepository.countByOrg).mockResolvedValue(2);
    await expect(planService.assertCanAddBranch("o1")).rejects.toMatchObject({
      statusCode: 403,
      code: "BRANCH_LIMIT_REACHED",
      message: 'Plan "starter" allows 2 branch(es). Upgrade to add more.',
    });
  });

  it("allows below the limit and when unlimited", async () => {
    vi.mocked(branchRepository.countByOrg).mockResolvedValue(1);
    await expect(planService.assertCanAddBranch("o1")).resolves.toBeUndefined();
    vi.mocked(planRepository.findByOrg).mockResolvedValue({ code: "ent", branchLimit: null } as never);
    await expect(planService.assertCanAddBranch("o1")).resolves.toBeUndefined();
  });

  it("counts inside the supplied transaction", async () => {
    vi.mocked(branchRepository.countByOrg).mockResolvedValue(0);
    const tx = { tx: true } as never;
    await planService.assertCanAddBranch("o1", tx);
    expect(branchRepository.countByOrg).toHaveBeenCalledWith("o1", tx);
  });
});

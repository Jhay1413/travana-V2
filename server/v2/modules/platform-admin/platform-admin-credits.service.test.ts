import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./platform-admin.repository", () => ({
  platformAdminRepository: { findOrgByIdWithCounts: vi.fn() },
}));
vi.mock("./platform-admin-credits.repository", () => ({
  startOfMonthUtc: () => "2026-06-01",
  platformAdminCreditsRepository: {
    findOrgCreditConfig: vi.fn(),
    findCurrentUsage: vi.fn(),
    sumPendingCharges: vi.fn(),
    setMonthlyLimit: vi.fn(),
    setOveragePriceCents: vi.fn(),
    addGrantedCredits: vi.fn(),
    findChargeById: vi.fn(),
    markWrittenOff: vi.fn(),
  },
}));
vi.mock("./platform-admin-audit.repository", () => ({
  platformAdminAuditRepository: { create: vi.fn() },
}));

import { platformAdminCreditsService } from "./platform-admin-credits.service";
import { platformAdminRepository } from "./platform-admin.repository";
import { platformAdminCreditsRepository } from "./platform-admin-credits.repository";

const ACTOR = { userId: "admin1", ipAddress: null, userAgent: null } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("platformAdminCreditsService.getSummary", () => {
  it("throws 404 when the org does not exist", async () => {
    vi.mocked(platformAdminRepository.findOrgByIdWithCounts).mockResolvedValue(undefined as never);

    await expect(platformAdminCreditsService.getSummary("o1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("computes allowance, remaining and overage from usage", async () => {
    vi.mocked(platformAdminRepository.findOrgByIdWithCounts).mockResolvedValue({ id: "o1" } as never);
    vi.mocked(platformAdminCreditsRepository.findOrgCreditConfig).mockResolvedValue({
      smsCreditsEnabled: true,
      monthlySmsCreditLimit: 100,
      smsOveragePriceCents: 5,
    } as never);
    vi.mocked(platformAdminCreditsRepository.findCurrentUsage).mockResolvedValue({ creditsUsed: 120, creditsGranted: 10 } as never);
    vi.mocked(platformAdminCreditsRepository.sumPendingCharges).mockResolvedValue(0 as never);

    const summary = await platformAdminCreditsService.getSummary("o1");

    // allowance = 100 + 10 = 110; remaining = max(0, 110 − 120) = 0; overage = 120 − 110 = 10
    expect(summary.currentPeriod).toMatchObject({ allowance: 110, remaining: 0, overageCredits: 10 });
  });
});

describe("platformAdminCreditsService.updateLimit", () => {
  it("rejects a negative limit", async () => {
    await expect(platformAdminCreditsService.updateLimit("o1", -1, undefined, ACTOR)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("returns 404 when the org has no credit config", async () => {
    vi.mocked(platformAdminCreditsRepository.findOrgCreditConfig).mockResolvedValue(undefined as never);

    await expect(platformAdminCreditsService.updateLimit("o1", 50, true, ACTOR)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("persists a valid limit", async () => {
    vi.mocked(platformAdminCreditsRepository.findOrgCreditConfig).mockResolvedValue({
      monthlySmsCreditLimit: 100,
      smsCreditsEnabled: true,
    } as never);

    await platformAdminCreditsService.updateLimit("o1", 50, false, ACTOR);

    expect(platformAdminCreditsRepository.setMonthlyLimit).toHaveBeenCalledWith("o1", 50, false);
  });
});

describe("platformAdminCreditsService.topUp", () => {
  it("rejects a non-positive top-up", async () => {
    await expect(platformAdminCreditsService.topUp("o1", 0, ACTOR)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("platformAdminCreditsService.writeOffCharge", () => {
  it("throws 404 for an unknown charge", async () => {
    vi.mocked(platformAdminCreditsRepository.findChargeById).mockResolvedValue(undefined as never);

    await expect(platformAdminCreditsService.writeOffCharge("o1", "c1", ACTOR)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("refuses to write off a non-pending charge", async () => {
    vi.mocked(platformAdminCreditsRepository.findChargeById).mockResolvedValue({ id: "c1", status: "charged" } as never);

    await expect(platformAdminCreditsService.writeOffCharge("o1", "c1", ACTOR)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(platformAdminCreditsRepository.markWrittenOff).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./referral-payout.repository", () => ({
  referralPayoutRepository: {
    findById: vi.fn(),
    findByIdWithOrg: vi.fn(),
    findAll: vi.fn(),
    findByClientId: vi.fn(),
    findByReferralId: vi.fn(),
    create: vi.fn(),
    markApproved: vi.fn(),
    markRejected: vi.fn(),
  },
}));
vi.mock("./referral.repository", () => ({
  referralRepository: {
    findByReferrerClientId: vi.fn(),
    findById: vi.fn(),
    updateStatus: vi.fn(),
  },
}));
vi.mock("../../../services/vipEnrollment.service", () => ({ vipEnrollmentService: { recalculateTier: vi.fn() } }));

import { referralPayoutService } from "./referral-payout.service";
import { referralPayoutRepository } from "./referral-payout.repository";
import { referralRepository } from "./referral.repository";

const TRUSTED = { orgId: null } as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("referralPayoutService.requestPayouts", () => {
  it("rejects when there are no eligible (pending + due) referrals", async () => {
    vi.mocked(referralRepository.findByReferrerClientId).mockResolvedValue([
      { id: "r1", referralStatus: "PENDING", isDue: false },
    ] as never);

    await expect(referralPayoutService.requestPayouts("c1")).rejects.toMatchObject({ statusCode: 400 });
    expect(referralPayoutRepository.create).not.toHaveBeenCalled();
  });

  it("rejects when every eligible referral already has a requested payout", async () => {
    vi.mocked(referralRepository.findByReferrerClientId).mockResolvedValue([
      { id: "r1", referralStatus: "PENDING", isDue: true, payoutAmount: "225.00" },
    ] as never);
    vi.mocked(referralPayoutRepository.findByReferralId).mockResolvedValue({ id: "p1", status: "requested" } as never);

    await expect(referralPayoutService.requestPayouts("c1")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("creates payout requests and totals their amounts", async () => {
    vi.mocked(referralRepository.findByReferrerClientId).mockResolvedValue([
      { id: "r1", referralStatus: "PENDING", isDue: true, payoutAmount: "225.00" },
      { id: "r2", referralStatus: "PENDING", isDue: true, payoutAmount: "100.00" },
    ] as never);
    vi.mocked(referralPayoutRepository.findByReferralId).mockResolvedValue(undefined as never);
    vi.mocked(referralPayoutRepository.create).mockResolvedValue({ id: "p" } as never);

    const result = await referralPayoutService.requestPayouts("c1");

    expect(result).toEqual({ count: 2, totalAmount: "325.00" });
  });
});

describe("referralPayoutService.approvePayout — guards", () => {
  it("rejects a payout that is not in the requested state", async () => {
    vi.mocked(referralPayoutRepository.findById).mockResolvedValue({ id: "p1", status: "approved", referral_id: "r1" } as never);

    await expect(referralPayoutService.approvePayout("p1", undefined, TRUSTED)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects when the underlying referral is no longer PENDING", async () => {
    vi.mocked(referralPayoutRepository.findById).mockResolvedValue({ id: "p1", status: "requested", referral_id: "r1" } as never);
    vi.mocked(referralRepository.findById).mockResolvedValue({ id: "r1", referralStatus: "IN_WALLET" } as never);

    await expect(referralPayoutService.approvePayout("p1", undefined, TRUSTED)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("approves the payout and moves the referral to IN_WALLET", async () => {
    vi.mocked(referralPayoutRepository.findById).mockResolvedValue({ id: "p1", status: "requested", referral_id: "r1" } as never);
    vi.mocked(referralRepository.findById).mockResolvedValue({ id: "r1", referralStatus: "PENDING", referrerClientId: "c1" } as never);
    vi.mocked(referralPayoutRepository.markApproved).mockResolvedValue({ id: "p1", status: "approved" } as never);

    await referralPayoutService.approvePayout("p1", "ok", TRUSTED);

    expect(referralPayoutRepository.markApproved).toHaveBeenCalledWith("p1", "ok");
    expect(referralRepository.updateStatus).toHaveBeenCalledWith("r1", "IN_WALLET");
  });
});

describe("referralPayoutService.getTotalEarningsByClient", () => {
  it("sums only the approved payouts", async () => {
    vi.mocked(referralPayoutRepository.findByClientId).mockResolvedValue([
      { status: "approved", amount: "100.00" },
      { status: "requested", amount: "50.00" },
      { status: "approved", amount: "25.50" },
    ] as never);

    const total = await referralPayoutService.getTotalEarningsByClient("c1");

    expect(total).toBeCloseTo(125.5, 2);
  });
});

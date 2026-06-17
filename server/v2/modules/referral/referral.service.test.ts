import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./referral.repository", () => ({
  referralRepository: {
    findById: vi.fn(),
    findByIdWithOrg: vi.fn(),
    findByTransactionId: vi.fn(),
    findByReferrerClientId: vi.fn(),
    findDueForAutoApproval: vi.fn(),
    findAll: vi.fn(),
    clientBelongsToOrg: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    delete: vi.fn(),
    voidByTransactionId: vi.fn(),
  },
}));
vi.mock("../../../services/vipEnrollment.service", () => ({
  vipEnrollmentService: { recalculateTier: vi.fn() },
}));
vi.mock("../wallet/wallet.service", () => ({
  walletService: { addReferralCredit: vi.fn() },
}));

import { referralService } from "./referral.service";
import { referralRepository } from "./referral.repository";
import { walletService } from "../wallet/wallet.service";

const TRUSTED = { orgId: null } as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("referralService.createReferral — payout math", () => {
  it("computes payout as 25% of commission net of the 10% Hays cut", async () => {
    vi.mocked(referralRepository.create).mockResolvedValue({ id: "r1" } as never);

    await referralService.createReferral({
      referrerClientId: "ref1",
      referredName: "Ada Lovelace",
      commission: "1000",
    });

    // 1000 − 10% = 900, then 25% = 225.00
    expect(vi.mocked(referralRepository.create).mock.calls[0][0]).toMatchObject({
      payoutAmount: "225.00",
      referralStatus: "PENDING",
    });
  });

  it("defaults payout to 0.00 when there is no commission", async () => {
    vi.mocked(referralRepository.create).mockResolvedValue({ id: "r1" } as never);

    await referralService.createReferral({ referrerClientId: "ref1", referredName: "Ada" });

    expect(vi.mocked(referralRepository.create).mock.calls[0][0]).toMatchObject({ payoutAmount: "0.00" });
  });

  it("derives a payout trigger date (travel date − 56 days) when a travel date is given", async () => {
    vi.mocked(referralRepository.create).mockResolvedValue({ id: "r1" } as never);

    await referralService.createReferral({
      referrerClientId: "ref1",
      referredName: "Ada",
      travelDate: "2026-03-01",
    });

    const payload = vi.mocked(referralRepository.create).mock.calls[0][0] as { payoutTriggerDate?: string };
    expect(payload.payoutTriggerDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("referralService.updateStatus — guards & side effects", () => {
  it("refuses to change the status of a PAID referral", async () => {
    vi.mocked(referralRepository.findById).mockResolvedValue({ id: "r1", referralStatus: "PAID" } as never);

    await expect(referralService.updateStatus("r1", "VOIDED", TRUSTED)).rejects.toMatchObject({ statusCode: 400 });
    expect(referralRepository.updateStatus).not.toHaveBeenCalled();
  });

  it("credits the referrer's wallet when moved to IN_WALLET", async () => {
    vi.mocked(referralRepository.findById).mockResolvedValue({
      id: "r1",
      referralStatus: "PENDING",
      referrerClientId: "ref1",
      payoutAmount: "225.00",
    } as never);
    vi.mocked(referralRepository.updateStatus).mockResolvedValue({ id: "r1" } as never);

    await referralService.updateStatus("r1", "IN_WALLET", TRUSTED);

    expect(walletService.addReferralCredit).toHaveBeenCalledWith("ref1", "r1", "225.00");
  });
});

describe("referralService.syncCommissionByTransaction", () => {
  it("recomputes payout for a PENDING referral", async () => {
    vi.mocked(referralRepository.findByTransactionId).mockResolvedValue({
      id: "r1",
      referralStatus: "PENDING",
    } as never);

    await referralService.syncCommissionByTransaction("t1", "2000");

    // 2000 − 10% = 1800, then 25% = 450.00
    expect(referralRepository.update).toHaveBeenCalledWith("r1", {
      commission: "2000",
      payoutAmount: "450.00",
    });
  });

  it("does nothing once the referral has left PENDING", async () => {
    vi.mocked(referralRepository.findByTransactionId).mockResolvedValue({
      id: "r1",
      referralStatus: "IN_WALLET",
    } as never);

    await referralService.syncCommissionByTransaction("t1", "2000");

    expect(referralRepository.update).not.toHaveBeenCalled();
  });
});

describe("referralService.voidReferralsByTransaction", () => {
  it("voids a non-paid referral for the transaction", async () => {
    vi.mocked(referralRepository.findByTransactionId).mockResolvedValue({
      id: "r1",
      referralStatus: "PENDING",
      referrerClientId: "ref1",
    } as never);

    await referralService.voidReferralsByTransaction("t1");

    expect(referralRepository.voidByTransactionId).toHaveBeenCalledWith("t1");
  });

  it("leaves a PAID referral untouched", async () => {
    vi.mocked(referralRepository.findByTransactionId).mockResolvedValue({
      id: "r1",
      referralStatus: "PAID",
      referrerClientId: "ref1",
    } as never);

    await referralService.voidReferralsByTransaction("t1");

    expect(referralRepository.voidByTransactionId).not.toHaveBeenCalled();
  });
});

describe("referralService.deleteReferral", () => {
  it("refuses to delete a PAID referral", async () => {
    vi.mocked(referralRepository.findById).mockResolvedValue({ id: "r1", referralStatus: "PAID" } as never);

    await expect(referralService.deleteReferral("r1", TRUSTED)).rejects.toMatchObject({ statusCode: 400 });
    expect(referralRepository.delete).not.toHaveBeenCalled();
  });
});

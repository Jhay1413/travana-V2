import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./referral-withdrawal.repository", () => ({
  referralWithdrawalRepository: {
    findById: vi.fn(),
    findByIdWithOrg: vi.fn(),
    findByIdWithDetails: vi.fn(),
    findAll: vi.fn(),
    findByClientId: vi.fn(),
    findByReferralId: vi.fn(),
    create: vi.fn(),
    markProcessed: vi.fn(),
    markRejected: vi.fn(),
    sumProcessedByClientId: vi.fn(),
  },
}));
vi.mock("./referral.repository", () => ({
  referralRepository: { findById: vi.fn(), findByReferrerClientId: vi.fn(), updateStatus: vi.fn() },
}));
vi.mock("../../../services/vipEnrollment.service", () => ({ vipEnrollmentService: { recalculateTier: vi.fn() } }));
vi.mock("../../../services/invoicePdf.service", () => ({
  generateWithdrawalInvoiceBuffer: vi.fn(),
  uploadWithdrawalInvoice: vi.fn(),
}));

import { referralWithdrawalService } from "./referral-withdrawal.service";
import { referralWithdrawalRepository } from "./referral-withdrawal.repository";
import { referralRepository } from "./referral.repository";

const TRUSTED = { orgId: null } as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("referralWithdrawalService.requestWithdrawal — guards", () => {
  it("throws 404 when the referral does not exist", async () => {
    vi.mocked(referralRepository.findById).mockResolvedValue(undefined as never);

    await expect(
      referralWithdrawalService.requestWithdrawal({ referralId: "r1", clientId: "c1", method: "booking_credit" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("requires the referral to be IN_WALLET", async () => {
    vi.mocked(referralRepository.findById).mockResolvedValue({ id: "r1", referralStatus: "PENDING", payoutAmount: "100" } as never);

    await expect(
      referralWithdrawalService.requestWithdrawal({ referralId: "r1", clientId: "c1", method: "booking_credit" }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("requires bank details for a bank transfer", async () => {
    vi.mocked(referralRepository.findById).mockResolvedValue({ id: "r1", referralStatus: "IN_WALLET", payoutAmount: "100" } as never);
    vi.mocked(referralWithdrawalRepository.findByReferralId).mockResolvedValue(undefined as never);

    await expect(
      referralWithdrawalService.requestWithdrawal({ referralId: "r1", clientId: "c1", method: "bank_transfer" }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("creates a pending withdrawal for a valid bank transfer", async () => {
    vi.mocked(referralRepository.findById).mockResolvedValue({ id: "r1", referralStatus: "IN_WALLET", payoutAmount: "225.00" } as never);
    vi.mocked(referralWithdrawalRepository.findByReferralId).mockResolvedValue(undefined as never);
    vi.mocked(referralWithdrawalRepository.create).mockResolvedValue({ id: "w1" } as never);

    await referralWithdrawalService.requestWithdrawal({
      referralId: "r1",
      clientId: "c1",
      method: "bank_transfer",
      account_name: "Ada",
      account_number: "12345678",
      sort_code: "00-00-00",
    });

    expect(vi.mocked(referralWithdrawalRepository.create).mock.calls[0][0]).toMatchObject({
      referral_id: "r1",
      amount: "225.00",
      method: "bank_transfer",
      status: "pending",
    });
  });
});

describe("referralWithdrawalService.processWithdrawal — guards", () => {
  it("rejects an already-processed withdrawal", async () => {
    vi.mocked(referralWithdrawalRepository.findById).mockResolvedValue({ id: "w1", status: "processed", method: "bank_transfer" } as never);

    await expect(referralWithdrawalService.processWithdrawal("w1", {}, TRUSTED)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("requires a transfer reference for a bank transfer", async () => {
    vi.mocked(referralWithdrawalRepository.findById).mockResolvedValue({ id: "w1", status: "pending", method: "bank_transfer", referral_id: "r1" } as never);

    await expect(referralWithdrawalService.processWithdrawal("w1", {}, TRUSTED)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("referralWithdrawalService.applyBookingCreditAdmin — allocation", () => {
  it("rejects a non-positive amount", async () => {
    await expect(referralWithdrawalService.applyBookingCreditAdmin("c1", "b1", 0)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a request that exceeds the available wallet balance", async () => {
    vi.mocked(referralRepository.findByReferrerClientId).mockResolvedValue([
      { id: "r1", referralStatus: "IN_WALLET", payoutAmount: "50", createdAt: "2026-01-01" },
    ] as never);

    await expect(referralWithdrawalService.applyBookingCreditAdmin("c1", "b1", 100)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("allocates the requested amount across referrals oldest-first", async () => {
    vi.mocked(referralRepository.findByReferrerClientId).mockResolvedValue([
      { id: "r1", referralStatus: "IN_WALLET", payoutAmount: "100", createdAt: "2026-01-01" },
      { id: "r2", referralStatus: "IN_WALLET", payoutAmount: "100", createdAt: "2026-02-01" },
    ] as never);
    vi.mocked(referralWithdrawalRepository.findByReferralId).mockResolvedValue(undefined as never);
    vi.mocked(referralWithdrawalRepository.create).mockResolvedValue({ id: "w" } as never);

    const result = await referralWithdrawalService.applyBookingCreditAdmin("c1", "b1", 150);

    expect(result).toEqual({ referralCount: 2, totalAmount: "150.00" });
    // first referral fully drained (100), second partially (50)
    expect(vi.mocked(referralWithdrawalRepository.create).mock.calls[0][0]).toMatchObject({ referral_id: "r1", amount: "100.00" });
    expect(vi.mocked(referralWithdrawalRepository.create).mock.calls[1][0]).toMatchObject({ referral_id: "r2", amount: "50.00" });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./wallet-transaction.repository", () => ({
  walletTransactionRepository: {
    clientBelongsToOrg: vi.fn(),
    bookingOfClientInWriteScope: vi.fn(),
    getBalance: vi.fn(),
    findByClientId: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    findByIdWithOrg: vi.fn(),
    findByIdWithDetails: vi.fn(),
    findPendingDebitByBookingId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock("../../../services/invoicePdf.service", () => ({
  generateWithdrawalInvoiceBuffer: vi.fn(),
  uploadWalletDebitInvoice: vi.fn(),
  getInvoicePresignedUrl: vi.fn(),
}));

import { walletService } from "./wallet.service";
import { walletTransactionRepository } from "./wallet-transaction.repository";

const TRUSTED = { orgId: null } as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(walletTransactionRepository.bookingOfClientInWriteScope).mockResolvedValue(true);
});

describe("walletService.applyBookingCredit — booking ownership", () => {
  const AGENT = { orgId: "org1", branchId: "b1", orgRole: "agent", orgRoles: ["agent"], userId: "u1", branchType: "shop", ownsHomeworkerBranch: false } as const;

  it("404s, and writes nothing, when the booking is not on this client or not in the caller's write scope", async () => {
    vi.mocked(walletTransactionRepository.clientBelongsToOrg).mockResolvedValue(true);
    vi.mocked(walletTransactionRepository.bookingOfClientInWriteScope).mockResolvedValue(false);
    vi.mocked(walletTransactionRepository.getBalance).mockResolvedValue(100 as never);

    await expect(walletService.applyBookingCredit("c1", "other-booking", 10, AGENT)).rejects.toMatchObject({ statusCode: 404 });
    expect(walletTransactionRepository.bookingOfClientInWriteScope).toHaveBeenCalledWith("other-booking", "c1", AGENT);
    expect(walletTransactionRepository.create).not.toHaveBeenCalled();
  });

  it("applies the credit when the booking is the client's and in scope", async () => {
    vi.mocked(walletTransactionRepository.clientBelongsToOrg).mockResolvedValue(true);
    vi.mocked(walletTransactionRepository.getBalance).mockResolvedValue(100 as never);
    vi.mocked(walletTransactionRepository.create).mockResolvedValue({ id: "w1" } as never);

    await expect(walletService.applyBookingCredit("c1", "b1", 10, AGENT)).resolves.toBeDefined();
    expect(walletTransactionRepository.create).toHaveBeenCalledOnce();
  });
});

describe("walletService.applyBookingCredit — balance guards", () => {
  it("rejects a non-positive amount", async () => {
    vi.mocked(walletTransactionRepository.getBalance).mockResolvedValue(100 as never);

    await expect(walletService.applyBookingCredit("c1", "b1", 0, TRUSTED)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(walletTransactionRepository.create).not.toHaveBeenCalled();
  });

  it("rejects an amount greater than the available balance", async () => {
    vi.mocked(walletTransactionRepository.getBalance).mockResolvedValue(50 as never);

    await expect(walletService.applyBookingCredit("c1", "b1", 75, TRUSTED)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(walletTransactionRepository.create).not.toHaveBeenCalled();
  });

  it("creates a pending debit when the amount is within balance", async () => {
    vi.mocked(walletTransactionRepository.getBalance).mockResolvedValue(50 as never);
    vi.mocked(walletTransactionRepository.create).mockResolvedValue({ id: "w1" } as never);

    await walletService.applyBookingCredit("c1", "b1", 30, TRUSTED);

    expect(walletTransactionRepository.create).toHaveBeenCalledOnce();
    expect(vi.mocked(walletTransactionRepository.create).mock.calls[0][0]).toMatchObject({
      client_id: "c1",
      type: "debit",
      source: "booking_credit",
      amount: "30.00",
      booking_id: "b1",
      status: "pending",
    });
  });

  it("allows spending the full balance (floating-point tolerance)", async () => {
    vi.mocked(walletTransactionRepository.getBalance).mockResolvedValue(50 as never);
    vi.mocked(walletTransactionRepository.create).mockResolvedValue({ id: "w1" } as never);

    await expect(walletService.applyBookingCredit("c1", "b1", 50, TRUSTED)).resolves.toBeDefined();
    expect(walletTransactionRepository.create).toHaveBeenCalledOnce();
  });
});

describe("walletService.requestBankTransfer", () => {
  const bank = { account_name: "Ada", account_number: "12345678", sort_code: "00-00-00" };

  it("rejects an amount greater than the available balance", async () => {
    vi.mocked(walletTransactionRepository.getBalance).mockResolvedValue(10 as never);

    await expect(walletService.requestBankTransfer("c1", 20, bank, TRUSTED)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(walletTransactionRepository.create).not.toHaveBeenCalled();
  });

  it("creates a pending bank_transfer debit carrying the bank details", async () => {
    vi.mocked(walletTransactionRepository.getBalance).mockResolvedValue(100 as never);
    vi.mocked(walletTransactionRepository.create).mockResolvedValue({ id: "w1" } as never);

    await walletService.requestBankTransfer("c1", 40, bank, TRUSTED);

    expect(vi.mocked(walletTransactionRepository.create).mock.calls[0][0]).toMatchObject({
      type: "debit",
      source: "bank_transfer",
      amount: "40.00",
      account_name: "Ada",
      account_number: "12345678",
      sort_code: "00-00-00",
      status: "pending",
    });
  });
});

describe("walletService.processDebit — state machine", () => {
  it("rejects a non-debit transaction", async () => {
    vi.mocked(walletTransactionRepository.findById).mockResolvedValue({ id: "w1", type: "credit", status: "pending" } as never);

    await expect(walletService.processDebit("w1", {}, TRUSTED)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an already-processed transaction", async () => {
    vi.mocked(walletTransactionRepository.findById).mockResolvedValue({ id: "w1", type: "debit", status: "processed" } as never);

    await expect(walletService.processDebit("w1", {}, TRUSTED)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("marks a pending debit processed", async () => {
    vi.mocked(walletTransactionRepository.findById).mockResolvedValue({ id: "w1", type: "debit", status: "pending" } as never);
    vi.mocked(walletTransactionRepository.update).mockResolvedValue({ id: "w1", status: "processed", processed_at: null } as never);
    // No detail row → skip the best-effort PDF generation path.
    vi.mocked(walletTransactionRepository.findByIdWithDetails).mockResolvedValue(undefined as never);

    await walletService.processDebit("w1", { transfer_reference: "REF1" }, TRUSTED);

    expect(vi.mocked(walletTransactionRepository.update).mock.calls[0][1]).toMatchObject({
      status: "processed",
      transfer_reference: "REF1",
    });
  });
});

describe("walletService.rejectDebit — state machine", () => {
  it("rejects anything that is not a pending debit", async () => {
    vi.mocked(walletTransactionRepository.findById).mockResolvedValue({ id: "w1", type: "debit", status: "processed" } as never);

    await expect(walletService.rejectDebit("w1", undefined, TRUSTED)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("marks a pending debit rejected", async () => {
    vi.mocked(walletTransactionRepository.findById).mockResolvedValue({ id: "w1", type: "debit", status: "pending" } as never);
    vi.mocked(walletTransactionRepository.update).mockResolvedValue({ id: "w1", status: "rejected" } as never);

    await walletService.rejectDebit("w1", "no good", TRUSTED);

    expect(walletTransactionRepository.update).toHaveBeenCalledWith("w1", { status: "rejected", notes: "no good" });
  });
});

describe("walletService.adjustBookingCredit", () => {
  it("voids an existing pending debit and re-applies the new amount", async () => {
    vi.mocked(walletTransactionRepository.findPendingDebitByBookingId).mockResolvedValue({ id: "old" } as never);
    vi.mocked(walletTransactionRepository.getBalance).mockResolvedValue(100 as never);
    vi.mocked(walletTransactionRepository.create).mockResolvedValue({ id: "new" } as never);

    await walletService.adjustBookingCredit("c1", "b1", 60);

    // old pending debit voided
    expect(vi.mocked(walletTransactionRepository.update).mock.calls[0]).toEqual([
      "old",
      { status: "rejected", notes: "Voided by booking credit adjustment" },
    ]);
    // new credit applied
    expect(vi.mocked(walletTransactionRepository.create).mock.calls[0][0]).toMatchObject({ amount: "60.00" });
  });

  it("voids the existing debit without creating a new one when the amount is 0", async () => {
    vi.mocked(walletTransactionRepository.findPendingDebitByBookingId).mockResolvedValue({ id: "old" } as never);

    await walletService.adjustBookingCredit("c1", "b1", 0);

    expect(walletTransactionRepository.update).toHaveBeenCalledOnce();
    expect(walletTransactionRepository.create).not.toHaveBeenCalled();
  });
});

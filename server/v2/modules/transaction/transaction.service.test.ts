import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./transaction.repository", () => ({
  transactionRepository: {
    findById: vi.fn(),
    findWithDetails: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    findExpiringQuotes: vi.fn(),
  },
}));
vi.mock("../enquiry/enquiry.repository", () => ({ enquiryTableRepository: { findByTransactionId: vi.fn() } }));
vi.mock("../quote/quote.repository", () => ({ newQuoteRepository: { findByTransactionId: vi.fn() } }));
vi.mock("../booking/booking.repository", () => ({ bookingRepository: { findByTransactionId: vi.fn() } }));
vi.mock("../note/note.repository", () => ({ noteRepository: {} }));
vi.mock("../task/task.service", () => ({ taskService: { reassignByEntity: vi.fn() } }));
vi.mock("../quote/quote.service", () => ({ newQuoteService: {} }));
vi.mock("../referral/referral.service", () => ({ referralService: {} }));
vi.mock("../../../services/vipEnrollment.service", () => ({ vipEnrollmentService: {} }));
vi.mock("../wallet/wallet.service", () => ({ walletService: {} }));
vi.mock("../neon-client/neon-client.repository", () => ({ neonClientRepository: {} }));

import { transactionService } from "./transaction.service";
import { transactionRepository } from "./transaction.repository";
import { newQuoteRepository } from "../quote/quote.repository";
import { bookingRepository } from "../booking/booking.repository";
import { enquiryTableRepository } from "../enquiry/enquiry.repository";
import { taskService } from "../task/task.service";

// transaction.service takes a real Scope; the repo is mocked so the value is opaque.
const SCOPE = { orgId: "org1", orgRole: "agent" } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("transactionService.getTransactionById", () => {
  it("throws 404 when the transaction is missing", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue(undefined as never);

    await expect(transactionService.getTransactionById("t1", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("returns the transaction when found", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1" } as never);

    await expect(transactionService.getTransactionById("t1", SCOPE)).resolves.toMatchObject({ id: "t1" });
  });
});

describe("transactionService.updateTransaction", () => {
  it("throws 404 when the transaction does not exist", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue(undefined as never);

    await expect(transactionService.updateTransaction("t1", { status: "on_quote" }, SCOPE)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(transactionRepository.update).not.toHaveBeenCalled();
  });

  it("reassigns related tasks when the owning user changes", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", user_id: "old" } as never);
    vi.mocked(transactionRepository.update).mockResolvedValue({ id: "t1", user_id: "new" } as never);
    vi.mocked(newQuoteRepository.findByTransactionId).mockResolvedValue([{ id: "q1" }] as never);
    vi.mocked(bookingRepository.findByTransactionId).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(enquiryTableRepository.findByTransactionId).mockResolvedValue({ id: "e1" } as never);

    await transactionService.updateTransaction("t1", { user_id: "new" }, SCOPE);

    expect(taskService.reassignByEntity).toHaveBeenCalledWith("quote", "q1", "new");
    expect(taskService.reassignByEntity).toHaveBeenCalledWith("booking", "b1", "new");
    expect(taskService.reassignByEntity).toHaveBeenCalledWith("enquiry", "e1", "new");
  });

  it("does NOT reassign tasks when the user is unchanged", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", user_id: "same" } as never);
    vi.mocked(transactionRepository.update).mockResolvedValue({ id: "t1", user_id: "same" } as never);

    await transactionService.updateTransaction("t1", { user_id: "same" }, SCOPE);

    expect(taskService.reassignByEntity).not.toHaveBeenCalled();
  });
});

describe("transactionService.deleteTransaction", () => {
  it("throws 404 when nothing was removed", async () => {
    vi.mocked(transactionRepository.remove).mockResolvedValue(false as never);

    await expect(transactionService.deleteTransaction("t1", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("resolves when the transaction is removed", async () => {
    vi.mocked(transactionRepository.remove).mockResolvedValue(true as never);

    await expect(transactionService.deleteTransaction("t1", SCOPE)).resolves.toBeUndefined();
  });
});

describe("transactionService.getExpiringQuotes — classification", () => {
  it("classifies a past expiry as expired and a future expiry as near_expiry", async () => {
    vi.mocked(transactionRepository.findExpiringQuotes).mockResolvedValue([
      {
        quoteId: "q-past",
        clientId: "c1",
        clientFirstName: "Ada",
        clientSurename: "Lovelace",
        salesPrice: "100",
        dateCreated: "2026-01-01",
        dateExpiry: "2000-01-01",
        transactionId: "t1",
      },
      {
        quoteId: "q-future",
        clientId: "c2",
        clientFirstName: "Grace",
        clientSurename: "Hopper",
        salesPrice: "200",
        dateCreated: "2026-01-01",
        dateExpiry: "2999-01-01",
        transactionId: "t2",
      },
    ] as never);

    const result = await transactionService.getExpiringQuotes(SCOPE);

    expect(result[0]).toMatchObject({ id: "q-past", status: "expired", clientName: "Ada Lovelace" });
    expect(result[1]).toMatchObject({ id: "q-future", status: "near_expiry", clientName: "Grace Hopper" });
  });

  it("falls back to 'Unknown Client' when no name parts are present", async () => {
    vi.mocked(transactionRepository.findExpiringQuotes).mockResolvedValue([
      {
        quoteId: "q1",
        clientId: "c1",
        clientTitle: "NULL",
        salesPrice: "100",
        dateCreated: "2026-01-01",
        dateExpiry: "2999-01-01",
        transactionId: "t1",
      },
    ] as never);

    const result = await transactionService.getExpiringQuotes(SCOPE);

    expect(result[0].clientName).toBe("Unknown Client");
  });
});

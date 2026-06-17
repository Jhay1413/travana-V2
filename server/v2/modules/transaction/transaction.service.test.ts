import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./transaction.repository", () => ({
  transactionRepository: {
    findById: vi.fn(),
    findWithDetails: vi.fn(),
    create: vi.fn(),
    createWithQuoteAndChildren: vi.fn(),
    createWithBookingAndChildren: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    findExpiringQuotes: vi.fn(),
  },
}));
vi.mock("../enquiry/enquiry.repository", () => ({
  enquiryTableRepository: {
    findByTransactionId: vi.fn(),
    create: vi.fn(),
    addDestination: vi.fn(),
    addResort: vi.fn(),
    addBoardBasis: vi.fn(),
    addDepartureAirport: vi.fn(),
    addPassenger: vi.fn(),
  },
}));
vi.mock("../quote/quote.repository", () => ({
  newQuoteRepository: {
    findByTransactionId: vi.fn(),
    replaceTransfers: vi.fn(),
    replaceCarHires: vi.fn(),
    replaceAttractionTickets: vi.fn(),
    replaceLoungePasses: vi.fn(),
    replaceAirportParkings: vi.fn(),
    replaceExtraAccommodations: vi.fn(),
    upsertCruise: vi.fn(),
  },
}));
vi.mock("../booking/booking.repository", () => ({
  bookingRepository: {
    findByTransactionId: vi.fn(),
    countByClientId: vi.fn(),
    addTransfer: vi.fn(),
    addCarHire: vi.fn(),
    addAttractionTicket: vi.fn(),
    addLoungePass: vi.fn(),
    addAirportParking: vi.fn(),
    addAccommodation: vi.fn(),
    upsertCruise: vi.fn(),
  },
}));
vi.mock("../note/note.repository", () => ({ noteRepository: { create: vi.fn() } }));
vi.mock("../task/task.service", () => ({ taskService: { reassignByEntity: vi.fn() } }));
vi.mock("../quote/quote.service", () => ({ newQuoteService: { createQuote: vi.fn() } }));
vi.mock("../referral/referral.service", () => ({ referralService: { createReferral: vi.fn() } }));
vi.mock("../../../services/vipEnrollment.service", () => ({ vipEnrollmentService: { enrollClient: vi.fn() } }));
vi.mock("../wallet/wallet.service", () => ({ walletService: { applyBookingCredit: vi.fn() } }));
vi.mock("../neon-client/neon-client.repository", () => ({ neonClientRepository: { findById: vi.fn(), update: vi.fn() } }));

import { transactionService } from "./transaction.service";
import { transactionRepository } from "./transaction.repository";
import { newQuoteRepository } from "../quote/quote.repository";
import { newQuoteService } from "../quote/quote.service";
import { bookingRepository } from "../booking/booking.repository";
import { enquiryTableRepository } from "../enquiry/enquiry.repository";
import { noteRepository } from "../note/note.repository";
import { taskService } from "../task/task.service";
import { walletService } from "../wallet/wallet.service";
import { referralService } from "../referral/referral.service";
import { neonClientRepository } from "../neon-client/neon-client.repository";

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

describe("transactionService.createTransactionWithEnquiry — add enquiry", () => {
  beforeEach(() => {
    vi.mocked(transactionRepository.create).mockResolvedValue({ id: "txn1" } as never);
    vi.mocked(enquiryTableRepository.create).mockResolvedValue({ id: "enq1" } as never);
  });

  it("creates the transaction as on_enquiry with the enquiry attached", async () => {
    const result = await transactionService.createTransactionWithEnquiry(
      {} as never,
      { travel_date: "2026-07-01" } as never,
      SCOPE,
    );

    expect(vi.mocked(transactionRepository.create).mock.calls[0][0]).toMatchObject({ status: "on_enquiry" });
    expect(vi.mocked(enquiryTableRepository.create).mock.calls[0][0]).toMatchObject({ transaction_id: "txn1" });
    expect(result).toMatchObject({ transaction: { id: "txn1" }, enquiry: { id: "enq1" } });
  });

  it("persists the enquiry's multi-value relations and notes", async () => {
    await transactionService.createTransactionWithEnquiry(
      {} as never,
      {
        destinations: ["d1", "d2"],
        passengers: [{ type: "adult" }, { type: "child", age: 7 }],
        notes: "Wants a beach resort",
      } as never,
      SCOPE,
    );

    expect(enquiryTableRepository.addDestination).toHaveBeenCalledTimes(2);
    expect(enquiryTableRepository.addPassenger).toHaveBeenCalledTimes(2);
    expect(enquiryTableRepository.addPassenger).toHaveBeenCalledWith("enq1", "child", 7);
    expect(noteRepository.create).toHaveBeenCalledOnce();
  });
});

describe("transactionService.createTransactionWithQuote — add quote", () => {
  beforeEach(() => {
    vi.mocked(transactionRepository.createWithQuoteAndChildren).mockResolvedValue({
      transaction: { id: "txn1", user_id: "u1" },
      quote: { id: "q1" },
    } as never);
    vi.mocked(transactionRepository.create).mockResolvedValue({ id: "freeTxn" } as never);
  });

  it("creates the quote+children and replaces provided line items", async () => {
    const result = await transactionService.createTransactionWithQuote(
      { is_test: false } as never,
      { not_for_social: true, transfers: [{ booking_ref: "T1" }] } as never,
      SCOPE,
    );

    expect(transactionRepository.createWithQuoteAndChildren).toHaveBeenCalledOnce();
    expect(newQuoteRepository.replaceTransfers).toHaveBeenCalledWith("q1", [{ booking_ref: "T1" }]);
    expect(result).toMatchObject({ quote: { id: "q1" } });
  });

  it("spins off a free social quote unless the quote is marked not_for_social / is_test", async () => {
    vi.mocked(newQuoteService.createQuote).mockResolvedValue({ id: "freeQ" } as never);

    await transactionService.createTransactionWithQuote(
      { is_test: false } as never,
      { not_for_social: false } as never,
      SCOPE,
    );

    expect(newQuoteService.createQuote).toHaveBeenCalledOnce();
  });

  it("does NOT create a free quote when not_for_social is set", async () => {
    await transactionService.createTransactionWithQuote(
      { is_test: false } as never,
      { not_for_social: true } as never,
      SCOPE,
    );

    expect(newQuoteService.createQuote).not.toHaveBeenCalled();
  });
});

describe("transactionService.createTransactionWithBooking — add booking", () => {
  beforeEach(() => {
    vi.mocked(transactionRepository.createWithBookingAndChildren).mockResolvedValue({
      transaction: { id: "txn1", client_id: "c1" },
      booking: { id: "b1", travel_date: null, package_commission: null },
    } as never);
    vi.mocked(neonClientRepository.findById).mockResolvedValue({ id: "c1", referredByClientId: null } as never);
    vi.mocked(bookingRepository.countByClientId).mockResolvedValue(1 as never);
  });

  it("creates the booking+children and adds provided transfers", async () => {
    const result = await transactionService.createTransactionWithBooking(
      {} as never,
      { transfers: [{ booking_ref: "T1" }] } as never,
      SCOPE,
    );

    expect(transactionRepository.createWithBookingAndChildren).toHaveBeenCalledOnce();
    expect(bookingRepository.addTransfer).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ booking: { id: "b1" } });
  });

  it("applies wallet credit when the booking carries a positive wallet_credit", async () => {
    await transactionService.createTransactionWithBooking(
      {} as never,
      { wallet_credit: "50" } as never,
      SCOPE,
    );

    expect(walletService.applyBookingCredit).toHaveBeenCalledWith("c1", "b1", 50, { orgId: null });
  });

  it("creates a referral when the client was referred", async () => {
    vi.mocked(neonClientRepository.findById).mockResolvedValue({
      id: "c1",
      referredByClientId: "ref1",
      firstName: "Ada",
      surename: "Lovelace",
    } as never);

    await transactionService.createTransactionWithBooking({} as never, {} as never, SCOPE);

    expect(referralService.createReferral).toHaveBeenCalledOnce();
    expect(vi.mocked(referralService.createReferral).mock.calls[0][0]).toMatchObject({ referrerClientId: "ref1" });
  });

  it("badges the client VIP at the 3-booking threshold", async () => {
    vi.mocked(bookingRepository.countByClientId).mockResolvedValue(3 as never);

    await transactionService.createTransactionWithBooking({} as never, {} as never, SCOPE);

    expect(neonClientRepository.update).toHaveBeenCalledWith("c1", { badge: "VIP Client" });
  });
});

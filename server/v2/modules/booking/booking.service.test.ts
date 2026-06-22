import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock the entire layer below the service ---------------------------------
// The service's only job is business logic; every collaborator it reaches for
// (repositories + sibling services) is replaced with a spy so these tests run
// with no database and assert ONLY the service's own rules.
vi.mock("./booking.repository", () => ({
  bookingRepository: {
    bookingInScope: vi.fn(),
    transactionInScope: vi.fn(),
    flightInScope: vi.fn(),
    accommodationInScope: vi.fn(),
    findById: vi.fn(),
    findByTransactionId: vi.fn(),
    findWithDetails: vi.fn(),
    findAllWithImages: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    countByClientId: vi.fn(),
    addFlight: vi.fn(),
    addAccommodation: vi.fn(),
    addTransfer: vi.fn(),
    addCarHire: vi.fn(),
    addAttractionTicket: vi.fn(),
    addLoungePass: vi.fn(),
    addAirportParking: vi.fn(),
    addCruise: vi.fn(),
    addCruiseItemExtra: vi.fn(),
    addCruiseItinerary: vi.fn(),
    addImages: vi.fn(),
    upsertFlightByType: vi.fn(),
    upsertPrimaryAccommodation: vi.fn(),
    upsertCruise: vi.fn(),
    replaceTransfers: vi.fn(),
    replaceCarHires: vi.fn(),
    replaceAttractionTickets: vi.fn(),
    replaceLoungePasses: vi.fn(),
    replaceAirportParkings: vi.fn(),
    replaceExtraAccommodations: vi.fn(),
  },
}));
vi.mock("../quote/quote.repository", () => ({
  newQuoteRepository: {
    findById: vi.fn(),
    findWithDetails: vi.fn(),
    update: vi.fn(),
    replaceChildPassengers: vi.fn(),
  },
}));
vi.mock("../quote/quote-image.repository", () => ({
  quoteImageRepository: { getByQuoteId: vi.fn() },
}));
vi.mock("../transaction/transaction.repository", () => ({
  transactionRepository: { findById: vi.fn(), update: vi.fn() },
}));
vi.mock("../neon-client/neon-client.repository", () => ({
  neonClientRepository: { update: vi.fn(), findById: vi.fn() },
}));
vi.mock("../../../services/vipEnrollment.service", () => ({ vipEnrollmentService: { enrollClient: vi.fn() } }));
vi.mock("../referral/referral.service", () => ({
  referralService: {
    createReferral: vi.fn(),
    ensureReferralForBooking: vi.fn(),
    syncCommissionByTransaction: vi.fn(),
    syncTravelDateByTransaction: vi.fn(),
    voidReferralsByTransaction: vi.fn(),
  },
}));
vi.mock("../tag/tag.service", () => ({ tagService: {} }));
vi.mock("../task/task.service", () => ({ taskService: { completeByEntity: vi.fn() } }));
vi.mock("../wallet/wallet.service", () => ({
  walletService: { applyBookingCredit: vi.fn(), adjustBookingCredit: vi.fn() },
}));
vi.mock("../sms/sms.service", () => ({ fireAutoTriggerForClient: vi.fn() }));

import { bookingService } from "./booking.service";
import { bookingRepository } from "./booking.repository";
import { newQuoteRepository } from "../quote/quote.repository";
import { quoteImageRepository } from "../quote/quote-image.repository";
import { transactionRepository } from "../transaction/transaction.repository";
import { neonClientRepository } from "../neon-client/neon-client.repository";
import { referralService } from "../referral/referral.service";
import { walletService } from "../wallet/wallet.service";
import { AppError } from "../../utils/error-handler";

// A "trusted" scope (orgId: null) short-circuits the in-scope assertions, so
// these tests exercise business logic without also wiring up scope checks.
const TRUSTED = { orgId: null } as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("bookingService.getBookingWithDetails — price math", () => {
  it("computes total_price as sales − discount + service charge", async () => {
    vi.mocked(bookingRepository.findWithDetails).mockResolvedValue({
      id: "b1",
      sales_price: "1000",
      discounts: "100",
      service_charge: "50",
      adult: 2,
      child: 0,
    } as never);

    const result = await bookingService.getBookingWithDetails("b1", TRUSTED);

    // 1000 − 100 + 50 = 950
    expect(result.total_price).toBe("950.00");
  });

  it("splits price_per_person across adults + children", async () => {
    vi.mocked(bookingRepository.findWithDetails).mockResolvedValue({
      id: "b1",
      sales_price: "1200",
      discounts: "0",
      service_charge: "0",
      adult: 2,
      child: 1,
    } as never);

    const result = await bookingService.getBookingWithDetails("b1", TRUSTED);

    // 1200 / (2 + 1) = 400.00
    expect(result.price_per_person).toBe("400.00");
  });

  it("returns 0.00 per person when there are no passengers (no divide-by-zero)", async () => {
    vi.mocked(bookingRepository.findWithDetails).mockResolvedValue({
      id: "b1",
      sales_price: "1200",
      discounts: "0",
      service_charge: "0",
      adult: 0,
      child: 0,
    } as never);

    const result = await bookingService.getBookingWithDetails("b1", TRUSTED);

    expect(result.price_per_person).toBe("0.00");
  });

  it("throws a 404 AppError when the booking does not exist", async () => {
    vi.mocked(bookingRepository.findWithDetails).mockResolvedValue(undefined as never);

    await expect(bookingService.getBookingWithDetails("missing", TRUSTED)).rejects.toMatchObject({
      constructor: AppError,
      statusCode: 404,
    });
  });
});

describe("bookingService.createBooking — guard rules", () => {
  const newBooking = { transaction_id: "t1", sales_price: "500", adult: 1, child: 0 } as never;

  it("throws 404 when the transaction does not exist", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue(undefined as never);

    await expect(bookingService.createBooking(newBooking, TRUSTED)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(bookingRepository.create).not.toHaveBeenCalled();
  });

  it("throws 400 when the transaction already has a booking", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", org_id: null, client_id: null } as never);
    vi.mocked(bookingRepository.findByTransactionId).mockResolvedValue({ id: "existing" } as never);

    await expect(bookingService.createBooking(newBooking, TRUSTED)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(bookingRepository.create).not.toHaveBeenCalled();
  });

  it("creates the booking and stamps a computed price_per_person when valid", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", org_id: null, client_id: null } as never);
    vi.mocked(bookingRepository.findByTransactionId).mockResolvedValue(undefined as never);
    vi.mocked(bookingRepository.create).mockResolvedValue({ id: "b1" } as never);

    await bookingService.createBooking(
      { transaction_id: "t1", sales_price: "600", adult: 2, child: 0 } as never,
      TRUSTED,
    );

    expect(bookingRepository.create).toHaveBeenCalledOnce();
    // 600 / 2 = 300.00 derived by the service, not taken from the caller
    expect(vi.mocked(bookingRepository.create).mock.calls[0][0]).toMatchObject({
      price_per_person: "300.00",
    });
  });
});

describe("bookingService.convertQuoteToBooking", () => {
  // Minimal valid setup: quote + transaction exist, no existing booking, no
  // relations and no client. Individual tests override what they care about.
  function happyPath() {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({
      id: "q1",
      transaction_id: "t1",
      sales_price: "900",
      adult: 3,
      child: 0,
      discounts: "0",
      service_charge: "0",
    } as never);
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", org_id: null, client_id: null } as never);
    vi.mocked(bookingRepository.findByTransactionId).mockResolvedValue(undefined as never);
    vi.mocked(bookingRepository.create).mockResolvedValue({ id: "b1", travel_date: null, package_commission: null } as never);
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({ flights: [], accommodations: [], passengers: [] } as never);
    vi.mocked(quoteImageRepository.getByQuoteId).mockResolvedValue([] as never);
  }

  it("throws 404 when the quote does not exist", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue(undefined as never);

    await expect(bookingService.convertQuoteToBooking("q1", "H1", "S1", TRUSTED)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(bookingRepository.create).not.toHaveBeenCalled();
  });

  it("throws 400 when the transaction already has a booking", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({ id: "q1", transaction_id: "t1" } as never);
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", org_id: null, client_id: null } as never);
    vi.mocked(bookingRepository.findByTransactionId).mockResolvedValue({ id: "existing" } as never);

    await expect(bookingService.convertQuoteToBooking("q1", "H1", "S1", TRUSTED)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(bookingRepository.create).not.toHaveBeenCalled();
  });

  it("creates the booking, marks the quote WON and the transaction on_booking", async () => {
    happyPath();

    const result = await bookingService.convertQuoteToBooking("q1", "H1", "S1", TRUSTED);

    expect(bookingRepository.create).toHaveBeenCalledOnce();
    // refs from args + price_per_person derived from the quote (900 / 3 = 300.00)
    expect(vi.mocked(bookingRepository.create).mock.calls[0][0]).toMatchObject({
      hays_ref: "H1",
      supplier_ref: "S1",
      booking_status: "BOOKED",
      price_per_person: "300.00",
    });
    // booking is stamped with the converted quote id (no WON status on quotes)
    expect(bookingRepository.update).toHaveBeenCalledWith(expect.any(String), { quote_id: "q1" });
    expect(transactionRepository.update).toHaveBeenCalledWith("t1", { status: "on_booking" });
    expect(result).toMatchObject({ id: "b1", client_id: null });
  });

  it("copies quote relations (e.g. flights) onto the new booking", async () => {
    happyPath();
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({
      flights: [{ flight_number: "BA123", flight_type: "outbound" }],
      accommodations: [],
      passengers: [],
    } as never);

    await bookingService.convertQuoteToBooking("q1", "H1", "S1", TRUSTED);

    expect(bookingRepository.addFlight).toHaveBeenCalledOnce();
    expect(vi.mocked(bookingRepository.addFlight).mock.calls[0][0]).toMatchObject({
      booking_id: "b1",
      flight_number: "BA123",
    });
  });

  it("badges the client VIP once they reach 3 bookings", async () => {
    happyPath();
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", org_id: null, client_id: "c1" } as never);
    vi.mocked(bookingRepository.countByClientId).mockResolvedValue(3 as never);
    vi.mocked(neonClientRepository.findById).mockResolvedValue({ id: "c1", referredByClientId: null } as never);

    await bookingService.convertQuoteToBooking("q1", "H1", "S1", TRUSTED);

    expect(neonClientRepository.update).toHaveBeenCalledWith("c1", { badge: "VIP Client" });
  });

  it("does NOT badge the client below 3 bookings", async () => {
    happyPath();
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", org_id: null, client_id: "c1" } as never);
    vi.mocked(bookingRepository.countByClientId).mockResolvedValue(2 as never);
    vi.mocked(neonClientRepository.findById).mockResolvedValue({ id: "c1", referredByClientId: null } as never);

    await bookingService.convertQuoteToBooking("q1", "H1", "S1", TRUSTED);

    expect(neonClientRepository.update).not.toHaveBeenCalled();
  });

  it("delegates referral recording to ensureReferralForBooking on conversion", async () => {
    happyPath();
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", org_id: null, client_id: "c1" } as never);
    vi.mocked(bookingRepository.countByClientId).mockResolvedValue(1 as never);
    vi.mocked(neonClientRepository.findById).mockResolvedValue({
      id: "c1",
      referredByClientId: "referrer1",
      firstName: "Ada",
      surename: "Lovelace",
      email: "ada@example.com",
      phoneNumber: "123",
    } as never);

    await bookingService.convertQuoteToBooking("q1", "H1", "S1", TRUSTED);

    expect(referralService.ensureReferralForBooking).toHaveBeenCalledOnce();
    const arg = vi.mocked(referralService.ensureReferralForBooking).mock.calls[0][0] as any;
    expect(arg.client).toMatchObject({ id: "c1", referredByClientId: "referrer1" });
    expect(arg.transactionId).toBeDefined();
  });
});

describe("bookingService.updateBooking", () => {
  it("recomputes price_per_person when a price input changes", async () => {
    vi.mocked(bookingRepository.findById).mockResolvedValue({
      id: "b1",
      sales_price: "900",
      adult: 2,
      child: 0,
      discounts: "0",
      service_charge: "0",
      wallet_credit: "0",
    } as never);
    vi.mocked(bookingRepository.update).mockResolvedValue({ id: "b1", transaction_id: "t1" } as never);
    vi.mocked(bookingRepository.findWithDetails).mockResolvedValue({ id: "b1" } as never);

    await bookingService.updateBooking("b1", { sales_price: "1000" } as never, TRUSTED);

    // 1000 / 2 = 500.00, recomputed from the merged current + new values
    expect(vi.mocked(bookingRepository.update).mock.calls[0][1]).toMatchObject({
      sales_price: "1000",
      price_per_person: "500.00",
    });
  });

  it("does NOT recompute price (or read current booking) when only a non-price field changes", async () => {
    vi.mocked(bookingRepository.update).mockResolvedValue({ id: "b1", transaction_id: "t1" } as never);
    vi.mocked(bookingRepository.findWithDetails).mockResolvedValue({ id: "b1" } as never);

    await bookingService.updateBooking("b1", { title: "New title" } as never, TRUSTED);

    expect(bookingRepository.findById).not.toHaveBeenCalled();
    expect(vi.mocked(bookingRepository.update).mock.calls[0][1]).not.toHaveProperty("price_per_person");
  });

  it("adjusts wallet credit when the wallet_credit amount changes", async () => {
    vi.mocked(bookingRepository.findById).mockResolvedValue({
      id: "b1",
      sales_price: "900",
      adult: 2,
      child: 0,
      discounts: "0",
      service_charge: "0",
      wallet_credit: "0",
    } as never);
    vi.mocked(bookingRepository.update).mockResolvedValue({ id: "b1", transaction_id: "t1" } as never);
    vi.mocked(bookingRepository.findWithDetails).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", client_id: "c1" } as never);

    await bookingService.updateBooking("b1", { wallet_credit: "50" } as never, TRUSTED);

    expect(walletService.adjustBookingCredit).toHaveBeenCalledWith("c1", "b1", 50);
  });

  it("syncs commission to referrals when package_commission changes", async () => {
    vi.mocked(bookingRepository.update).mockResolvedValue({ id: "b1", transaction_id: "t1" } as never);
    vi.mocked(bookingRepository.findWithDetails).mockResolvedValue({ id: "b1" } as never);

    await bookingService.updateBooking("b1", { package_commission: "120" } as never, TRUSTED);

    expect(referralService.syncCommissionByTransaction).toHaveBeenCalledWith("t1", "120");
  });

  it("changes booking_status without recomputing price", async () => {
    vi.mocked(bookingRepository.update).mockResolvedValue({ id: "b1", transaction_id: "t1" } as never);
    vi.mocked(bookingRepository.findWithDetails).mockResolvedValue({ id: "b1" } as never);

    await bookingService.updateBooking("b1", { booking_status: "CANCELLED" } as never, TRUSTED);

    expect(bookingRepository.findById).not.toHaveBeenCalled(); // no price recompute
    const updateArg = vi.mocked(bookingRepository.update).mock.calls[0][1];
    expect(updateArg).toMatchObject({ booking_status: "CANCELLED" });
    expect(updateArg).not.toHaveProperty("price_per_person");
  });
});

describe("bookingService — scope enforcement", () => {
  // A real (non-trusted) org-scoped caller.
  const ORG_SCOPE = { orgId: "o1", orgRole: "agent" } as never;

  it("returns 404 when the booking is outside the caller's org", async () => {
    vi.mocked(bookingRepository.bookingInScope).mockResolvedValue(false as never);

    await expect(bookingService.getBookingById("b1", ORG_SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(bookingRepository.findById).not.toHaveBeenCalled();
  });

  it("reads the booking when it is in the caller's org", async () => {
    vi.mocked(bookingRepository.bookingInScope).mockResolvedValue(true as never);
    vi.mocked(bookingRepository.findById).mockResolvedValue({ id: "b1" } as never);

    await expect(bookingService.getBookingById("b1", ORG_SCOPE)).resolves.toMatchObject({ id: "b1" });
  });

  it("bypasses the scope check for a platform_admin", async () => {
    vi.mocked(bookingRepository.findById).mockResolvedValue({ id: "b1" } as never);

    await bookingService.getBookingById("b1", { orgId: "o1", orgRole: "platform_admin" } as never);

    expect(bookingRepository.bookingInScope).not.toHaveBeenCalled();
    expect(bookingRepository.findById).toHaveBeenCalledWith("b1");
  });
});

describe("bookingService.deleteBooking", () => {
  it("voids referrals for the transaction before removing the booking", async () => {
    vi.mocked(bookingRepository.findById).mockResolvedValue({ id: "b1", transaction_id: "t1" } as never);

    await bookingService.deleteBooking("b1", TRUSTED);

    expect(referralService.voidReferralsByTransaction).toHaveBeenCalledWith("t1");
    expect(bookingRepository.remove).toHaveBeenCalledWith("b1");
  });

  it("removes the booking even when it has no transaction (nothing to void)", async () => {
    vi.mocked(bookingRepository.findById).mockResolvedValue({ id: "b1", transaction_id: null } as never);

    await bookingService.deleteBooking("b1", TRUSTED);

    expect(referralService.voidReferralsByTransaction).not.toHaveBeenCalled();
    expect(bookingRepository.remove).toHaveBeenCalledWith("b1");
  });
});

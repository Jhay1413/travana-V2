import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./quote.repository", () => ({
  newQuoteRepository: {
    quoteInScope: vi.fn(),
    transactionInScope: vi.fn(),
    findById: vi.fn(),
    findWithDetails: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    findLostSiblings: vi.fn(),
    replaceChildPassengers: vi.fn(),
    upsertFlightByType: vi.fn(),
    replaceConnectingLegs: vi.fn(),
    upsertPrimaryAccommodation: vi.fn(),
    replaceTransfers: vi.fn(),
    replaceCarHires: vi.fn(),
    replaceAttractionTickets: vi.fn(),
    replaceLoungePasses: vi.fn(),
    replaceAirportParkings: vi.fn(),
    replaceExtraAccommodations: vi.fn(),
    upsertCruise: vi.fn(),
    saveImagesToAccommodation: vi.fn(),
    saveImagesToLodge: vi.fn(),
  },
}));
vi.mock("../transaction/transaction.repository", () => ({
  transactionRepository: { findById: vi.fn(), update: vi.fn(), create: vi.fn() },
}));
vi.mock("./quote-image.repository", () => ({ quoteImageRepository: { addImages: vi.fn(), getByQuoteId: vi.fn() } }));
vi.mock("../tag/tag.service", () => ({ tagService: { addQuoteTags: vi.fn(), updateQuoteTags: vi.fn() } }));
vi.mock("../task/task.service", () => ({ taskService: { completeByEntity: vi.fn() } }));
vi.mock("../enquiry/enquiry.repository", () => ({ enquiryTableRepository: { findByTransactionId: vi.fn() } }));
vi.mock("../destination-guru/destination-guru.service", () => ({ destinationGuruService: { generate: vi.fn() } }));

import { newQuoteService } from "./quote.service";
import { newQuoteRepository } from "./quote.repository";
import { transactionRepository } from "../transaction/transaction.repository";
import { quoteImageRepository } from "./quote-image.repository";
import { taskService } from "../task/task.service";
import { enquiryTableRepository } from "../enquiry/enquiry.repository";

const TRUSTED = { orgId: null } as const;

beforeEach(() => {
  vi.clearAllMocks();
  // Default: scope assertions pass.
  vi.mocked(newQuoteRepository.quoteInScope).mockResolvedValue(true as never);
  vi.mocked(newQuoteRepository.transactionInScope).mockResolvedValue(true as never);
});

describe("newQuoteService.getQuoteWithDetails — price math", () => {
  it("computes total_price and price_per_person from stored values", async () => {
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({
      id: "q1",
      sales_price: "1000",
      discounts: "100",
      service_charge: "50",
      adult: 3,
      child: 0,
    } as never);

    const result = await newQuoteService.getQuoteWithDetails("q1", TRUSTED);

    expect(result.total_price).toBe("950.00"); // 1000 − 100 + 50
    expect(result.price_per_person).toBe("316.67"); // 950 / 3
  });

  it("throws 404 when the quote does not exist", async () => {
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue(undefined as never);

    await expect(newQuoteService.getQuoteWithDetails("missing", TRUSTED)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("newQuoteService.createQuote", () => {
  it("throws 404 when the transaction does not exist", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue(undefined as never);

    await expect(
      newQuoteService.createQuote({ transaction_id: "t1", isFreeQuote: true } as never, TRUSTED),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(newQuoteRepository.create).not.toHaveBeenCalled();
  });

  it("computes price_per_person when the caller did not supply one", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", org_id: null, status: "on_quote" } as never);
    vi.mocked(newQuoteRepository.create).mockResolvedValue({ id: "q1" } as never);

    await newQuoteService.createQuote(
      { transaction_id: "t1", isFreeQuote: true, sales_price: "600", adult: 2, child: 0 } as never,
      TRUSTED,
    );

    expect(vi.mocked(newQuoteRepository.create).mock.calls[0][0]).toMatchObject({
      price_per_person: "300.00", // 600 / 2
    });
  });

  it("preserves a non-zero price_per_person supplied by the caller", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", org_id: null, status: "on_quote" } as never);
    vi.mocked(newQuoteRepository.create).mockResolvedValue({ id: "q1" } as never);

    await newQuoteService.createQuote(
      { transaction_id: "t1", isFreeQuote: true, sales_price: "600", adult: 2, price_per_person: "999.99" } as never,
      TRUSTED,
    );

    expect(vi.mocked(newQuoteRepository.create).mock.calls[0][0]).toMatchObject({
      price_per_person: "999.99",
    });
  });
});

describe("newQuoteService.updateQuote", () => {
  it("recomputes price_per_person when a price input changes", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({
      id: "q1",
      sales_price: "900",
      adult: 2,
      child: 0,
      discounts: "0",
      service_charge: "0",
      quote_status: "PENDING",
      transaction_id: "t1",
    } as never);
    vi.mocked(newQuoteRepository.update).mockResolvedValue({ id: "q1", transaction_id: "t1", quote_status: "PENDING" } as never);
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({ id: "q1" } as never);

    await newQuoteService.updateQuote("q1", { sales_price: "1000" } as never, TRUSTED);

    expect(vi.mocked(newQuoteRepository.update).mock.calls[0][1]).toMatchObject({
      sales_price: "1000",
      price_per_person: "500.00", // 1000 / 2
    });
  });

  it("deactivates the quote and its transaction when marked LOST", async () => {
    vi.mocked(newQuoteRepository.update).mockResolvedValue({ id: "q1", transaction_id: "t1", quote_status: "LOST" } as never);
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({ id: "q1" } as never);

    await newQuoteService.updateQuote("q1", { quote_status: "LOST" } as never, TRUSTED);

    expect(newQuoteRepository.update).toHaveBeenCalledWith("q1", { is_active: false });
    expect(transactionRepository.update).toHaveBeenCalledWith("t1", { is_active: false });
  });
});

describe("newQuoteService.deleteQuote", () => {
  it("throws 404 when the quote does not exist", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue(undefined as never);

    await expect(newQuoteService.deleteQuote("q1", TRUSTED)).rejects.toMatchObject({ statusCode: 404 });
    expect(newQuoteRepository.remove).not.toHaveBeenCalled();
  });

  it("removes the quote when it exists", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({ id: "q1" } as never);

    await newQuoteService.deleteQuote("q1", TRUSTED);

    expect(newQuoteRepository.remove).toHaveBeenCalledWith("q1");
  });

  it("closes out the quote's open tasks when deleted", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({ id: "q1" } as never);

    await newQuoteService.deleteQuote("q1", TRUSTED);

    expect(taskService.completeByEntity).toHaveBeenCalledWith("quote", "q1");
  });

  it("still deletes the quote when completing its tasks fails", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({ id: "q1" } as never);
    vi.mocked(taskService.completeByEntity).mockRejectedValueOnce(new Error("boom") as never);

    await expect(newQuoteService.deleteQuote("q1", TRUSTED)).resolves.not.toThrow();
    expect(newQuoteRepository.remove).toHaveBeenCalledWith("q1");
  });
});

describe("newQuoteService.createQuote — enquiry → quote conversion", () => {
  it("flips the transaction to on_quote and closes the enquiry's tasks", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", org_id: null, status: "on_enquiry" } as never);
    vi.mocked(newQuoteRepository.create).mockResolvedValue({ id: "q1" } as never);
    vi.mocked(enquiryTableRepository.findByTransactionId).mockResolvedValue({ id: "enq1" } as never);

    await newQuoteService.createQuote(
      { transaction_id: "t1", isFreeQuote: true, sales_price: "600", adult: 2 } as never,
      TRUSTED,
    );

    expect(transactionRepository.update).toHaveBeenCalledWith("t1", { status: "on_quote" });
    expect(taskService.completeByEntity).toHaveBeenCalledWith("enquiry", "enq1");
  });

  it("leaves an already-booked transaction's status alone", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", org_id: null, status: "on_booking" } as never);
    vi.mocked(newQuoteRepository.create).mockResolvedValue({ id: "q1" } as never);

    await newQuoteService.createQuote(
      { transaction_id: "t1", isFreeQuote: true, sales_price: "600", adult: 2 } as never,
      TRUSTED,
    );

    expect(transactionRepository.update).not.toHaveBeenCalled();
  });
});

describe("newQuoteService.updateQuote — revive from LOST", () => {
  it("reactivates the quote and transaction when moving off LOST (no LOST siblings)", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({
      id: "q1",
      quote_status: "LOST",
      transaction_id: "t1",
    } as never);
    vi.mocked(newQuoteRepository.update).mockResolvedValue({ id: "q1", transaction_id: "t1", quote_status: "QUOTE_IN_PROGRESS" } as never);
    vi.mocked(newQuoteRepository.findLostSiblings).mockResolvedValue([] as never);
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({ id: "q1" } as never);

    await newQuoteService.updateQuote("q1", { quote_status: "QUOTE_IN_PROGRESS" } as never, TRUSTED);

    // quote reactivated with a fresh expiry
    const reviveCall = vi.mocked(newQuoteRepository.update).mock.calls.find((c) => (c[1] as Record<string, unknown>).is_active === true);
    expect(reviveCall).toBeDefined();
    // transaction reactivated because no sibling is still LOST
    expect(transactionRepository.update).toHaveBeenCalledWith("t1", { is_active: true });
  });

  it("keeps the transaction inactive when a sibling quote is still LOST", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({
      id: "q1",
      quote_status: "LOST",
      transaction_id: "t1",
    } as never);
    vi.mocked(newQuoteRepository.update).mockResolvedValue({ id: "q1", transaction_id: "t1", quote_status: "QUOTE_IN_PROGRESS" } as never);
    vi.mocked(newQuoteRepository.findLostSiblings).mockResolvedValue([{ id: "q2" }] as never);
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({ id: "q1" } as never);

    await newQuoteService.updateQuote("q1", { quote_status: "QUOTE_IN_PROGRESS" } as never, TRUSTED);

    expect(transactionRepository.update).not.toHaveBeenCalledWith("t1", { is_active: true });
  });
});

describe("newQuoteService.duplicateQuote", () => {
  it("copies the source quote (merging images, flagging isQuoteCopy) and clones child ages", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({
      id: "src",
      transaction_id: "t1",
      sales_price: "500",
      adult: 2,
      quote_type: "package",
    } as never);
    vi.mocked(quoteImageRepository.getByQuoteId).mockResolvedValue([{ url: "img1" }] as never);
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({
      transfers: [], carHires: [], attractionTickets: [], loungePasses: [], airportParkings: [], accommodations: [],
      passengers: [{ type: "child", age: 5 }],
      tags: ["tagA"],
    } as never);
    const createSpy = vi.spyOn(newQuoteService, "createQuote").mockResolvedValue({ id: "newQ" } as never);

    try {
      await newQuoteService.duplicateQuote("src", { images: ["img2"] } as never, TRUSTED);

      const payload = createSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(payload).toMatchObject({ transaction_id: "t1", isQuoteCopy: true, tags: ["tagA"] });
      expect(payload.images).toEqual(["img1", "img2"]); // source + requested, deduped
      // the source's child ages are cloned onto the new quote
      expect(newQuoteRepository.replaceChildPassengers).toHaveBeenCalledWith("newQ", "quote", [5]);
    } finally {
      createSpy.mockRestore();
    }
  });

  it("throws 404 when the source quote does not exist", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue(undefined as never);

    await expect(newQuoteService.duplicateQuote("missing", {} as never, TRUSTED)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

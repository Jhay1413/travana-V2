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
    promoteSiblingAndRemove: vi.fn(),
    findLostSiblings: vi.fn(),
    countActiveSiblings: vi.fn(),
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
    isEmbeddableFreeQuote: vi.fn(),
    findFreeQuotesPaginated: vi.fn(),
    countFreeQuotesBySocialStatus: vi.fn(),
    findRecentClientEngagement: vi.fn(),
    getServiceCommission: vi.fn(),
    setAccepted: vi.fn(),
    findTourOperatorIds: vi.fn(),
    findFlightTourOperatorId: vi.fn(),
    findAccommodationTourOperatorId: vi.fn(),
    flightBelongsToOrg: vi.fn(),
    accommodationBelongsToOrg: vi.fn(),
    addFlight: vi.fn(),
    updateFlight: vi.fn(),
    updateAccommodation: vi.fn(),
  },
}));
// The REAL link service runs; only its repository is faked.
vi.mock("../tour-operator/org-tour-operator.repository", () => ({
  orgTourOperatorRepository: { findLinkedOperatorIds: vi.fn() },
}));
vi.mock("../transaction/transaction.repository", () => ({
  transactionRepository: { findById: vi.fn(), update: vi.fn(), create: vi.fn() },
}));
vi.mock("./quote-image.repository", () => ({ quoteImageRepository: { addImages: vi.fn(), getByQuoteId: vi.fn() } }));
vi.mock("../tag/tag.service", () => ({ tagService: { addQuoteTags: vi.fn(), updateQuoteTags: vi.fn() } }));
vi.mock("../task/task.service", () => ({ taskService: { completeByEntity: vi.fn() } }));
vi.mock("../enquiry/enquiry.repository", () => ({ enquiryTableRepository: { findByTransactionId: vi.fn() } }));
vi.mock("../destination-guru/destination-guru.service", () => ({ destinationGuruService: { generate: vi.fn() } }));
vi.mock("../ai-embeddings/ai-embeddings.service", () => ({
  aiEmbeddingsService: { syncSource: vi.fn(), removeSource: vi.fn(), removeSourceById: vi.fn() },
}));

import { newQuoteService } from "./quote.service";
import { newQuoteRepository } from "./quote.repository";
import { transactionRepository } from "../transaction/transaction.repository";
import { aiEmbeddingsService } from "../ai-embeddings/ai-embeddings.service";
import { quoteImageRepository } from "./quote-image.repository";
import { taskService } from "../task/task.service";
import { enquiryTableRepository } from "../enquiry/enquiry.repository";
import { orgTourOperatorRepository } from "../tour-operator/org-tour-operator.repository";

const TRUSTED = { orgId: null } as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(newQuoteRepository.getServiceCommission).mockResolvedValue(0 as never);
  // Default: scope assertions pass.
  vi.mocked(newQuoteRepository.quoteInScope).mockResolvedValue(true as never);
  vi.mocked(newQuoteRepository.transactionInScope).mockResolvedValue(true as never);
  // Default: no active siblings (lost guard passes by default).
  vi.mocked(newQuoteRepository.countActiveSiblings).mockResolvedValue(0 as never);
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

  it("adds the line-item service_commission from the repository", async () => {
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({ id: "q1", sales_price: "100", adult: 1, child: 0 } as never);
    vi.mocked(newQuoteRepository.getServiceCommission).mockResolvedValue(42.5 as never);

    const result = await newQuoteService.getQuoteWithDetails("q1", TRUSTED);

    expect(newQuoteRepository.getServiceCommission).toHaveBeenCalledWith("q1");
    expect(result.service_commission).toBe(42.5);
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

  it("never persists accepted_at / accepted_by supplied on create", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", org_id: null, status: "on_quote" } as never);
    vi.mocked(newQuoteRepository.create).mockResolvedValue({ id: "q1" } as never);

    await newQuoteService.createQuote(
      { transaction_id: "t1", isFreeQuote: true, sales_price: "600", adult: 2, accepted_at: new Date(), accepted_by: "u9", quote_sent_at: new Date(), quote_sent_via: "link", quote_token: "tok" } as never,
      TRUSTED,
    );

    const written = vi.mocked(newQuoteRepository.create).mock.calls[0][0] as Record<string, unknown>;
    expect(written).not.toHaveProperty("accepted_at");
    expect(written).not.toHaveProperty("accepted_by");
    expect(written).not.toHaveProperty("quote_sent_at");
    expect(written).not.toHaveProperty("quote_sent_via");
    expect(written).not.toHaveProperty("quote_token");
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

  it("excludes discounts and service_charge from a free quote, computing price_per_person from the undiscounted figures", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", org_id: null, status: "on_quote" } as never);
    vi.mocked(newQuoteRepository.create).mockResolvedValue({ id: "q1" } as never);

    await newQuoteService.createQuote(
      {
        transaction_id: "t1", isFreeQuote: true, sales_price: "600", adult: 2, child: 0,
        discounts: "100", service_charge: "50",
      } as never,
      TRUSTED,
    );

    expect(vi.mocked(newQuoteRepository.create).mock.calls[0][0]).toMatchObject({
      discounts: null,
      service_charge: null,
      price_per_person: "300.00", // 600 / 2 — undiscounted, not (600-100+50)/2
    });
  });

  it("overrides a caller-supplied price_per_person when a free quote's discount/service_charge is actually cleared", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", org_id: null, status: "on_quote" } as never);
    vi.mocked(newQuoteRepository.create).mockResolvedValue({ id: "q1" } as never);

    await newQuoteService.createQuote(
      {
        transaction_id: "t1", isFreeQuote: true, sales_price: "600", adult: 2, child: 0,
        discounts: "100", service_charge: "50", price_per_person: "999.99",
      } as never,
      TRUSTED,
    );

    // The supplied 999.99 was computed WITH the discount/service charge — once
    // those are stripped for a free quote, it's stale and must be recomputed
    // from the undiscounted figures, not preserved.
    expect(vi.mocked(newQuoteRepository.create).mock.calls[0][0]).toMatchObject({
      discounts: null,
      service_charge: null,
      price_per_person: "300.00", // 600 / 2
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

  it("deactivates the quote and its transaction when marked lost", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({
      id: "q1",
      transaction_id: "t1",
      quote_status: "quoted",
      isQuoteCopy: true,
    } as never);
    vi.mocked(newQuoteRepository.update).mockResolvedValue({ id: "q1", transaction_id: "t1", quote_status: "lost" } as never);
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({ id: "q1" } as never);

    await newQuoteService.updateQuote("q1", { quote_status: "lost" } as never, TRUSTED);

    expect(newQuoteRepository.update).toHaveBeenCalledWith("q1", { is_active: false });
    expect(transactionRepository.update).toHaveBeenCalledWith("t1", { is_active: false });
  });

  it("still deactivates the transaction when lost on an on_quote transaction", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({ id: "q1", transaction_id: "t1", quote_status: "quoted" } as never);
    vi.mocked(newQuoteRepository.update).mockResolvedValue({ id: "q1", transaction_id: "t1", quote_status: "lost" } as never);
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({ id: "q1" } as never);
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", status: "on_quote" } as never);

    await newQuoteService.updateQuote("q1", { quote_status: "lost" } as never, TRUSTED);

    expect(newQuoteRepository.update).toHaveBeenCalledWith("q1", { is_active: false });
    expect(transactionRepository.update).toHaveBeenCalledWith("t1", { is_active: false });
  });

  it("does NOT deactivate the transaction when lost on an on_booking transaction, but still deactivates the quote", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({ id: "q1", transaction_id: "t1", quote_status: "quoted" } as never);
    vi.mocked(newQuoteRepository.update).mockResolvedValue({ id: "q1", transaction_id: "t1", quote_status: "lost" } as never);
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({ id: "q1" } as never);
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", status: "on_booking" } as never);

    await newQuoteService.updateQuote("q1", { quote_status: "lost" } as never, TRUSTED);

    expect(newQuoteRepository.update).toHaveBeenCalledWith("q1", { is_active: false });
    expect(transactionRepository.update).not.toHaveBeenCalledWith("t1", { is_active: false });
  });

  it("reactivates the quote and transaction when moving off lost with no lost siblings", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({ id: "q1", transaction_id: "t1", quote_status: "lost" } as never);
    vi.mocked(newQuoteRepository.update).mockResolvedValue({ id: "q1", transaction_id: "t1", quote_status: "quoted" } as never);
    vi.mocked(newQuoteRepository.findLostSiblings).mockResolvedValue([] as never);
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({ id: "q1" } as never);

    await newQuoteService.updateQuote("q1", { quote_status: "quoted" } as never, TRUSTED);

    expect(newQuoteRepository.update).toHaveBeenCalledWith("q1", { is_active: true });
    expect(transactionRepository.update).toHaveBeenCalledWith("t1", { is_active: true });
  });

  it("persists childAges when an edit submits them, so ages survive the round trip", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({
      id: "q1",
      transaction_id: "t1",
      quote_status: "quoted",
    } as never);
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({ id: "q1" } as never);

    await newQuoteService.updateQuote("q1", { childAges: [5, 8] } as never, TRUSTED);

    expect(newQuoteRepository.replaceChildPassengers).toHaveBeenCalledWith("q1", "quote", [5, 8]);
  });

  it("clears childAges when an edit explicitly submits an empty array", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({
      id: "q1",
      transaction_id: "t1",
      quote_status: "quoted",
    } as never);
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({ id: "q1" } as never);

    await newQuoteService.updateQuote("q1", { childAges: [] } as never, TRUSTED);

    expect(newQuoteRepository.replaceChildPassengers).toHaveBeenCalledWith("q1", "quote", []);
  });
});

describe("newQuoteService.setAccepted", () => {
  const detail = { id: "q1", service_commission: 0 };
  beforeEach(() => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({ id: "q1", isFreeQuote: false, accepted_at: null } as never);
    vi.mocked(newQuoteRepository.setAccepted).mockResolvedValue({ id: "q1" } as never);
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({ id: "q1", sales_price: "100", adult: 1, child: 0 } as never);
  });

  it("marks the quote accepted by the user after the scope check and returns the enriched row", async () => {
    const result = await newQuoteService.setAccepted("q1", true, "u1", TRUSTED);

    expect(newQuoteRepository.quoteInScope).toHaveBeenCalledWith("q1", TRUSTED);
    expect(newQuoteRepository.setAccepted).toHaveBeenCalledWith("q1", true, "u1");
    expect(result).toMatchObject({ ...detail, total_price: "100.00" });
  });

  it("keeps the first stamp when the quote is already accepted", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({ id: "q1", isFreeQuote: false, accepted_at: new Date(), accepted_by: "first" } as never);
    await newQuoteService.setAccepted("q1", true, "second", TRUSTED);
    expect(newQuoteRepository.setAccepted).not.toHaveBeenCalled();
  });

  it("clears the mark when accepted is false, even if already accepted", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({ id: "q1", isFreeQuote: false, accepted_at: new Date() } as never);
    await newQuoteService.setAccepted("q1", false, "u1", TRUSTED);
    expect(newQuoteRepository.setAccepted).toHaveBeenCalledWith("q1", false, "u1");
  });

  it("refuses free quotes with a 400", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({ id: "q1", isFreeQuote: true } as never);
    await expect(newQuoteService.setAccepted("q1", true, "u1", TRUSTED)).rejects.toMatchObject({ statusCode: 400 });
    expect(newQuoteRepository.setAccepted).not.toHaveBeenCalled();
  });

  it("404s and never writes when the quote is out of scope", async () => {
    vi.mocked(newQuoteRepository.quoteInScope).mockResolvedValue(false as never);
    await expect(newQuoteService.setAccepted("q1", true, "u1", TRUSTED)).rejects.toMatchObject({ statusCode: 404 });
    expect(newQuoteRepository.setAccepted).not.toHaveBeenCalled();
  });

  it("404s when the update matched no row (deleted quote)", async () => {
    vi.mocked(newQuoteRepository.setAccepted).mockResolvedValue(undefined as never);
    await expect(newQuoteService.setAccepted("q1", true, "u1", TRUSTED)).rejects.toMatchObject({ statusCode: 404 });
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

  describe("primary-with-siblings guard", () => {
    it("deletes a primary quote with no live siblings cleanly, no prompt needed", async () => {
      vi.mocked(newQuoteRepository.findById).mockResolvedValue({
        id: "q1", transaction_id: "t1", isQuoteCopy: false,
      } as never);
      vi.mocked(newQuoteRepository.countActiveSiblings).mockResolvedValue(0 as never);

      await newQuoteService.deleteQuote("q1", TRUSTED);

      expect(newQuoteRepository.remove).toHaveBeenCalledWith("q1");
      expect(newQuoteRepository.promoteSiblingAndRemove).not.toHaveBeenCalled();
    });

    it("throws 400 when deleting a primary with siblings and no newPrimaryQuoteId", async () => {
      vi.mocked(newQuoteRepository.findById).mockResolvedValue({
        id: "q1", transaction_id: "t1", isQuoteCopy: false,
      } as never);
      vi.mocked(newQuoteRepository.countActiveSiblings).mockResolvedValue(1 as never);

      await expect(newQuoteService.deleteQuote("q1", TRUSTED)).rejects.toMatchObject({
        statusCode: 400,
        message: "NEW_PRIMARY_REQUIRED",
      });
      expect(newQuoteRepository.remove).not.toHaveBeenCalled();
      expect(newQuoteRepository.promoteSiblingAndRemove).not.toHaveBeenCalled();
    });

    it("promotes the chosen sibling and removes the old primary when a valid newPrimaryQuoteId is given", async () => {
      vi.mocked(newQuoteRepository.findById)
        .mockResolvedValueOnce({ id: "q1", transaction_id: "t1", isQuoteCopy: false } as never) // target
        .mockResolvedValueOnce({ id: "q2", transaction_id: "t1", isQuoteCopy: true, quote_status: "quoted" } as never); // candidate
      vi.mocked(newQuoteRepository.countActiveSiblings).mockResolvedValue(1 as never);

      await newQuoteService.deleteQuote("q1", TRUSTED, "q2");

      expect(newQuoteRepository.promoteSiblingAndRemove).toHaveBeenCalledWith("q2", "q1", expect.any(Date));
      expect(newQuoteRepository.remove).not.toHaveBeenCalled();
    });

    it("rejects a newPrimaryQuoteId that belongs to a different transaction", async () => {
      vi.mocked(newQuoteRepository.findById)
        .mockResolvedValueOnce({ id: "q1", transaction_id: "t1", isQuoteCopy: false } as never)
        .mockResolvedValueOnce({ id: "q9", transaction_id: "t-other", isQuoteCopy: true, quote_status: "quoted" } as never);
      vi.mocked(newQuoteRepository.countActiveSiblings).mockResolvedValue(1 as never);

      await expect(newQuoteService.deleteQuote("q1", TRUSTED, "q9")).rejects.toMatchObject({
        statusCode: 400,
        message: "INVALID_NEW_PRIMARY",
      });
      expect(newQuoteRepository.promoteSiblingAndRemove).not.toHaveBeenCalled();
      expect(newQuoteRepository.remove).not.toHaveBeenCalled();
    });

    it("rejects a newPrimaryQuoteId that is soft-deleted", async () => {
      vi.mocked(newQuoteRepository.findById)
        .mockResolvedValueOnce({ id: "q1", transaction_id: "t1", isQuoteCopy: false } as never)
        .mockResolvedValueOnce({
          id: "q2", transaction_id: "t1", isQuoteCopy: true, quote_status: "quoted", deleted_at: new Date(),
        } as never);
      vi.mocked(newQuoteRepository.countActiveSiblings).mockResolvedValue(1 as never);

      await expect(newQuoteService.deleteQuote("q1", TRUSTED, "q2")).rejects.toMatchObject({
        statusCode: 400,
        message: "INVALID_NEW_PRIMARY",
      });
      expect(newQuoteRepository.promoteSiblingAndRemove).not.toHaveBeenCalled();
      expect(newQuoteRepository.remove).not.toHaveBeenCalled();
    });

    it("deletes a non-primary copy without triggering the guard", async () => {
      vi.mocked(newQuoteRepository.findById).mockResolvedValue({
        id: "q2", transaction_id: "t1", isQuoteCopy: true,
      } as never);

      await newQuoteService.deleteQuote("q2", TRUSTED);

      expect(newQuoteRepository.countActiveSiblings).not.toHaveBeenCalled();
      expect(newQuoteRepository.remove).toHaveBeenCalledWith("q2");
      expect(newQuoteRepository.promoteSiblingAndRemove).not.toHaveBeenCalled();
    });
  });
});

describe("newQuoteService.createQuote — auto free social copy", () => {
  // createFreeSocialCopy is fire-and-forget from createQuote — wait for its
  // microtask chain rather than the awaited createQuote call.
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("excludes the source's discount/service_charge from the free copy and recomputes price_per_person from the undiscounted figures", async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", org_id: null, status: "on_quote", is_test: false } as never);
    vi.mocked(newQuoteRepository.create)
      .mockResolvedValueOnce({ id: "q1" } as never) // primary quote
      .mockResolvedValueOnce({ id: "freeQ1" } as never); // auto-generated free copy
    vi.mocked(transactionRepository.create).mockResolvedValue({ id: "freeTxn1" } as never);

    await newQuoteService.createQuote(
      {
        transaction_id: "t1", isFreeQuote: false, sales_price: "600", adult: 2, child: 0,
        discounts: "100", service_charge: "50", price_per_person: "275.00",
      } as never,
      TRUSTED,
    );
    await flush();

    // The primary (non-free) quote keeps its own discount/service charge and
    // the caller-supplied price_per_person untouched.
    expect(vi.mocked(newQuoteRepository.create).mock.calls[0][0]).toMatchObject({
      discounts: "100", service_charge: "50", price_per_person: "275.00",
    });
    // The free copy excludes both and recomputes price_per_person from the
    // undiscounted sales price — not the inherited 275.00.
    expect(vi.mocked(newQuoteRepository.create).mock.calls[1][0]).toMatchObject({
      isFreeQuote: true,
      discounts: null,
      service_charge: null,
      price_per_person: "300.00", // 600 / 2
    });
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

describe("newQuoteService.updateQuote — revive from lost", () => {
  it("reactivates the quote and transaction when moving off lost (no lost siblings)", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({
      id: "q1",
      quote_status: "lost",
      transaction_id: "t1",
    } as never);
    vi.mocked(newQuoteRepository.update).mockResolvedValue({ id: "q1", transaction_id: "t1", quote_status: "quoted" } as never);
    vi.mocked(newQuoteRepository.findLostSiblings).mockResolvedValue([] as never);
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({ id: "q1" } as never);

    await newQuoteService.updateQuote("q1", { quote_status: "quoted" } as never, TRUSTED);

    // quote reactivated (is_active: true, no date_expiry bump)
    const reviveCall = vi.mocked(newQuoteRepository.update).mock.calls.find((c) => (c[1] as Record<string, unknown>).is_active === true);
    expect(reviveCall).toBeDefined();
    expect((reviveCall![1] as Record<string, unknown>).date_expiry).toBeUndefined();
    // transaction reactivated because no sibling is still lost
    expect(transactionRepository.update).toHaveBeenCalledWith("t1", { is_active: true });
  });

  it("keeps the transaction inactive when a sibling quote is still lost", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({
      id: "q1",
      quote_status: "lost",
      transaction_id: "t1",
    } as never);
    vi.mocked(newQuoteRepository.update).mockResolvedValue({ id: "q1", transaction_id: "t1", quote_status: "quoted" } as never);
    vi.mocked(newQuoteRepository.findLostSiblings).mockResolvedValue([{ id: "q2" }] as never);
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({ id: "q1" } as never);

    await newQuoteService.updateQuote("q1", { quote_status: "quoted" } as never, TRUSTED);

    expect(transactionRepository.update).not.toHaveBeenCalledWith("t1", { is_active: true });
  });
});

describe("newQuoteService.duplicateQuote", () => {
  it("copies the source quote (caller images win, flagging isQuoteCopy) and clones child ages", async () => {
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
      // The dialog seeds the form with the source's images, so the submitted
      // list is the final gallery — the source's images are NOT merged back in.
      expect(payload.images).toEqual(["img2"]);
      // the source's child ages are cloned onto the new quote
      expect(newQuoteRepository.replaceChildPassengers).toHaveBeenCalledWith("newQ", "quote", [5]);
    } finally {
      createSpy.mockRestore();
    }
  });

  it("does not carry the sent / accepted state of the source onto the copy", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({
      id: "src", transaction_id: "t1", sales_price: "500",
      quote_sent_at: new Date(), quote_sent_via: "link", accepted_at: new Date(), accepted_by: "u1",
    } as never);
    vi.mocked(quoteImageRepository.getByQuoteId).mockResolvedValue([] as never);
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({
      transfers: [], carHires: [], attractionTickets: [], loungePasses: [], airportParkings: [], accommodations: [],
      passengers: [], tags: [],
    } as never);
    const createSpy = vi.spyOn(newQuoteService, "createQuote").mockResolvedValue({ id: "newQ" } as never);

    try {
      await newQuoteService.duplicateQuote("src", {} as never, TRUSTED);

      const payload = createSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(payload).toMatchObject({ sales_price: "500" });
      for (const key of ["quote_sent_at", "quote_sent_via", "accepted_at", "accepted_by"]) {
        expect(payload).not.toHaveProperty(key);
      }
    } finally {
      createSpy.mockRestore();
    }
  });

  it("clones the source's images when the caller sends no images field", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({ id: "src", transaction_id: "t1" } as never);
    vi.mocked(quoteImageRepository.getByQuoteId).mockResolvedValue([{ url: "img1" }] as never);
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({
      transfers: [], carHires: [], attractionTickets: [], loungePasses: [], airportParkings: [], accommodations: [],
      passengers: [],
      tags: [],
    } as never);
    const createSpy = vi.spyOn(newQuoteService, "createQuote").mockResolvedValue({ id: "newQ" } as never);

    try {
      await newQuoteService.duplicateQuote("src", {} as never, TRUSTED);

      const payload = createSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.images).toEqual(["img1"]);
    } finally {
      createSpy.mockRestore();
    }
  });

  it("removes all images when the caller sends an empty images array", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({ id: "src", transaction_id: "t1" } as never);
    vi.mocked(quoteImageRepository.getByQuoteId).mockResolvedValue([{ url: "img1" }] as never);
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({
      transfers: [], carHires: [], attractionTickets: [], loungePasses: [], airportParkings: [], accommodations: [],
      passengers: [],
      tags: [],
    } as never);
    const createSpy = vi.spyOn(newQuoteService, "createQuote").mockResolvedValue({ id: "newQ" } as never);

    try {
      await newQuoteService.duplicateQuote("src", { images: [] } as never, TRUSTED);

      const payload = createSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.images).toEqual([]);
    } finally {
      createSpy.mockRestore();
    }
  });

  it("prefers caller-supplied tags over the source's", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({ id: "src", transaction_id: "t1" } as never);
    vi.mocked(quoteImageRepository.getByQuoteId).mockResolvedValue([] as never);
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({
      transfers: [], carHires: [], attractionTickets: [], loungePasses: [], airportParkings: [], accommodations: [],
      passengers: [],
      tags: ["fromSource"],
    } as never);
    const createSpy = vi.spyOn(newQuoteService, "createQuote").mockResolvedValue({ id: "newQ" } as never);

    try {
      await newQuoteService.duplicateQuote("src", { tags: ["edited"] } as never, TRUSTED);

      const payload = createSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.tags).toEqual(["edited"]);
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


// The quote vector store has two writers — this one and the backfill script —
// and they had drifted: the backfill required six conditions, this path checked
// isFreeQuote alone. So the live store accumulated rows a rebuild would never
// reproduce, and nothing but a HARD delete ever removed one.
describe("newQuoteService — free-quote embedding lifecycle", () => {
  // The embedding sync is deliberately fire-and-forget, so the assertions have
  // to wait for its microtask chain rather than the awaited call.
  const flush = () => new Promise((r) => setTimeout(r, 0));

  function freeQuoteUpdate() {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({
      id: "q1", transaction_id: "t1", quote_status: "quoted", isFreeQuote: true,
    } as never);
    // `q` in updateQuote is the UPDATE's return value, not findById's.
    vi.mocked(newQuoteRepository.update).mockResolvedValue({
      id: "q1", transaction_id: "t1", quote_status: "quoted", isFreeQuote: true,
    } as never);
    vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({ id: "q1", isFreeQuote: true } as never);
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", org_id: "org-1" } as never);
  }

  it("embeds a free quote that still qualifies", async () => {
    freeQuoteUpdate();
    vi.mocked(newQuoteRepository.isEmbeddableFreeQuote).mockResolvedValue(true as never);

    await newQuoteService.updateQuote("q1", { sales_price: "1000" } as never, TRUSTED);
    await flush();

    expect(aiEmbeddingsService.syncSource).toHaveBeenCalled();
    expect(aiEmbeddingsService.removeSourceById).not.toHaveBeenCalled();
  });

  it("REMOVES the embedding when the quote no longer qualifies, rather than skipping", async () => {
    // Deactivated, soft-deleted, moved onto a test transaction, or flagged
    // not_for_social — all of these now retract the embedding. Skipping is why
    // a deactivated free quote stayed retrievable by the AI indefinitely.
    freeQuoteUpdate();
    vi.mocked(newQuoteRepository.isEmbeddableFreeQuote).mockResolvedValue(false as never);

    await newQuoteService.updateQuote("q1", { sales_price: "1000" } as never, TRUSTED);
    await flush();

    expect(aiEmbeddingsService.removeSourceById).toHaveBeenCalledWith("quote", "q1");
    expect(aiEmbeddingsService.syncSource).not.toHaveBeenCalled();
  });

  it("asks the shared predicate, never isFreeQuote alone", async () => {
    freeQuoteUpdate();
    vi.mocked(newQuoteRepository.isEmbeddableFreeQuote).mockResolvedValue(true as never);

    await newQuoteService.updateQuote("q1", { sales_price: "1000" } as never, TRUSTED);
    await flush();

    expect(newQuoteRepository.isEmbeddableFreeQuote).toHaveBeenCalledWith("q1");
  });
});

describe("newQuoteService — free-quote social status", () => {
  it("forwards socialStatus as the last repository argument", async () => {
    vi.mocked(newQuoteRepository.findFreeQuotesPaginated).mockResolvedValue([] as never);

    await newQuoteService.listFreeQuotesPaginated(0, 12, false, "none", "", "", "", TRUSTED, false, false, "all", [], "draft");

    const args = vi.mocked(newQuoteRepository.findFreeQuotesPaginated).mock.calls[0];
    expect(args[12]).toBe("draft");
    expect(args[7]).toBe(TRUSTED);
  });

  it("leaves socialStatus undefined when not supplied (existing callers unchanged)", async () => {
    vi.mocked(newQuoteRepository.findFreeQuotesPaginated).mockResolvedValue([] as never);

    await newQuoteService.listFreeQuotesPaginated(0, 12, false, "none", "", "", "", TRUSTED);

    expect(vi.mocked(newQuoteRepository.findFreeQuotesPaginated).mock.calls[0][12]).toBeUndefined();
  });

  it("getFreeQuoteStatusCounts passes search, tags and scope to the repository and returns its counts", async () => {
    const counts = { total: 10, not_generated: 4, draft: 3, scheduled: 2, posted: 1 };
    vi.mocked(newQuoteRepository.countFreeQuotesBySocialStatus).mockResolvedValue(counts as never);

    const result = await newQuoteService.getFreeQuoteStatusCounts("rome", ["Summer"], TRUSTED);

    expect(newQuoteRepository.countFreeQuotesBySocialStatus).toHaveBeenCalledWith("rome", ["Summer"], TRUSTED);
    expect(result).toEqual(counts);
  });
});

describe("newQuoteService.getRecentClientEngagement", () => {
  const scopeFor = (orgRole: string) => ({ orgId: "o1", orgRole, userId: "u1" }) as never;

  beforeEach(() => {
    vi.mocked(newQuoteRepository.findRecentClientEngagement).mockResolvedValue([] as never);
  });

  it("without params: agents are limited to themselves, managers/admins stay org-wide (unchanged)", async () => {
    await newQuoteService.getRecentClientEngagement(scopeFor("agent"), 10);
    expect(newQuoteRepository.findRecentClientEngagement).toHaveBeenLastCalledWith({
      orgId: "o1", userId: "u1", limit: 10, viewedFrom: undefined, viewedBefore: undefined,
    });

    for (const role of ["org_admin", "branch_manager", "platform_admin"]) {
      await newQuoteService.getRecentClientEngagement(scopeFor(role), 10);
      expect(vi.mocked(newQuoteRepository.findRecentClientEngagement).mock.lastCall?.[0].userId).toBeNull();
    }
  });

  it("mine=true forces the scope user for every role", async () => {
    for (const role of ["agent", "org_admin", "branch_manager", "platform_admin"]) {
      await newQuoteService.getRecentClientEngagement(scopeFor(role), 10, { mine: true });
      expect(vi.mocked(newQuoteRepository.findRecentClientEngagement).mock.lastCall?.[0].userId).toBe("u1");
    }
  });

  it("keeps org scoping (platform_admin is unscoped, others use their org)", async () => {
    await newQuoteService.getRecentClientEngagement(scopeFor("platform_admin"), 10, { mine: true });
    expect(vi.mocked(newQuoteRepository.findRecentClientEngagement).mock.lastCall?.[0].orgId).toBeNull();
    await newQuoteService.getRecentClientEngagement(scopeFor("agent"), 10, { mine: true });
    expect(vi.mocked(newQuoteRepository.findRecentClientEngagement).mock.lastCall?.[0].orgId).toBe("o1");
  });

  it("passes London-day period bounds to the repository", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T12:00:00Z")); // Fri 13:00 BST
    try {
      const bounds = async (period: "today" | "yesterday" | "week" | "all") => {
        await newQuoteService.getRecentClientEngagement(scopeFor("agent"), 10, { period });
        const arg = vi.mocked(newQuoteRepository.findRecentClientEngagement).mock.lastCall?.[0];
        return [arg?.viewedFrom?.toISOString(), arg?.viewedBefore?.toISOString()];
      };
      expect(await bounds("today")).toEqual(["2026-10-15T23:00:00.000Z", undefined]);
      expect(await bounds("yesterday")).toEqual(["2026-10-14T23:00:00.000Z", "2026-10-15T23:00:00.000Z"]);
      expect(await bounds("week")).toEqual(["2026-10-11T23:00:00.000Z", undefined]);
      expect(await bounds("all")).toEqual([undefined, undefined]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("newQuoteService.getRecentClientEngagement - mine without a user", () => {
  it("throws 401 instead of widening to org-wide", async () => {
    const scope = { orgId: "o1", orgRole: "org_admin" } as never;
    await expect(newQuoteService.getRecentClientEngagement(scope, 10, { mine: true })).rejects.toMatchObject({ statusCode: 401 });
    expect(newQuoteRepository.findRecentClientEngagement).not.toHaveBeenCalled();
  });
});

describe("newQuoteService - operator must be in the org's list", () => {
  const ORG = { orgId: "o1", orgRole: "org_admin" } as never;
  const OP_A = "11111111-1111-4111-8111-111111111111";
  const OP_B = "22222222-2222-4222-8222-222222222222";
  const linked = vi.mocked(orgTourOperatorRepository.findLinkedOperatorIds);

  beforeEach(() => {
    linked.mockReset();
    linked.mockImplementation(async (_org, ids) => ids.filter((id) => id === OP_A));
    vi.mocked(transactionRepository.findById).mockResolvedValue({ id: "t1", org_id: "o1" } as never);
    vi.mocked(newQuoteRepository.create).mockResolvedValue({ id: "q1" } as never);
    vi.mocked(newQuoteRepository.findTourOperatorIds).mockResolvedValue([]);
  });

  it("createQuote accepts linked operators and checks main and line items together", async () => {
    await newQuoteService.createQuote({ transaction_id: "t1", main_tour_operator_id: OP_A, transfers: [{ tour_operator_id: OP_A }] } as never, ORG);
    expect(linked).toHaveBeenCalledWith("o1", [OP_A]);
  });

  it("createQuote rejects an unlinked line-item operator before writing", async () => {
    await expect(
      newQuoteService.createQuote({ transaction_id: "t1", main_tour_operator_id: OP_A, transfers: [{ tour_operator_id: OP_B }] } as never, ORG),
    ).rejects.toMatchObject({ statusCode: 400, message: "Tour operator is not in your list" });
    expect(newQuoteRepository.create).not.toHaveBeenCalled();
  });

  it("a trusted call or a payload without operators is not checked", async () => {
    await newQuoteService.createQuote({ transaction_id: "t1", main_tour_operator_id: OP_B } as never, TRUSTED);
    await newQuoteService.createQuote({ transaction_id: "t1" } as never, ORG);
    expect(linked).not.toHaveBeenCalled();
  });

  it("updateQuote exempts operators already on the quote but rejects a new unlinked one", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({ id: "q1" } as never);
    vi.mocked(newQuoteRepository.update).mockResolvedValue({ id: "q1" } as never);
    vi.mocked(newQuoteRepository.findTourOperatorIds).mockResolvedValue([OP_B]);
    await newQuoteService.updateQuote("q1", { main_tour_operator_id: OP_B } as never, ORG);
    expect(linked).not.toHaveBeenCalled();
    vi.mocked(newQuoteRepository.findTourOperatorIds).mockResolvedValue([]);
    await expect(newQuoteService.updateQuote("q1", { main_tour_operator_id: OP_B } as never, ORG)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("updateQuote looks nothing up when no operator is sent", async () => {
    vi.mocked(newQuoteRepository.findById).mockResolvedValue({ id: "q1" } as never);
    vi.mocked(newQuoteRepository.update).mockResolvedValue({ id: "q1" } as never);
    await newQuoteService.updateQuote("q1", { sales_price: "100" } as never, ORG);
    expect(newQuoteRepository.findTourOperatorIds).not.toHaveBeenCalled();
  });

  it("updateFlight exempts the operator already on the flight line", async () => {
    vi.mocked(newQuoteRepository.flightBelongsToOrg).mockResolvedValue(true);
    vi.mocked(newQuoteRepository.findFlightTourOperatorId).mockResolvedValue(OP_B);
    vi.mocked(newQuoteRepository.updateFlight).mockResolvedValue({ id: "f1" } as never);
    await newQuoteService.updateFlight("f1", { tour_operator_id: OP_B } as never, ORG);
    expect(linked).not.toHaveBeenCalled();
  });

  describe("copy to client (createQuote with sourceQuoteId)", () => {
    beforeEach(() => {
      vi.mocked(newQuoteRepository.findTourOperatorIds).mockResolvedValue([OP_B]);
    });

    it("keeps the source quote's unlinked operator allowed", async () => {
      await newQuoteService.createQuote({ transaction_id: "t1", main_tour_operator_id: OP_B } as never, ORG, { sourceQuoteId: "src" });
      expect(newQuoteRepository.findTourOperatorIds).toHaveBeenCalledWith("src");
      expect(newQuoteRepository.create).toHaveBeenCalled();
    });

    it("still rejects an unlinked operator that is not on the source", async () => {
      const OP_C = "33333333-3333-4333-8333-333333333333";
      await expect(
        newQuoteService.createQuote({ transaction_id: "t1", main_tour_operator_id: OP_C } as never, ORG, { sourceQuoteId: "src" }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("404s when the source quote is outside the caller's scope", async () => {
      vi.mocked(newQuoteRepository.quoteInScope).mockResolvedValue(false as never);
      await expect(
        newQuoteService.createQuote({ transaction_id: "t1", main_tour_operator_id: OP_B } as never, ORG, { sourceQuoteId: "other-org" }),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(newQuoteRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("duplicateQuote is exempt for the source's own operators", () => {
    beforeEach(() => {
      vi.mocked(newQuoteRepository.findById).mockResolvedValue({ id: "src", transaction_id: "t1", main_tour_operator_id: OP_B } as never);
      vi.mocked(quoteImageRepository.getByQuoteId).mockResolvedValue([] as never);
      vi.mocked(newQuoteRepository.findWithDetails).mockResolvedValue({
        transfers: [{ tour_operator_id: OP_B }], carHires: [], attractionTickets: [], loungePasses: [], airportParkings: [], accommodations: [], tags: [], passengers: [],
      } as never);
      vi.mocked(newQuoteRepository.findTourOperatorIds).mockResolvedValue([OP_B]);
    });

    it("succeeds when the source quote's operator is no longer in the agency's list", async () => {
      const out = await newQuoteService.duplicateQuote("src", {} as never, ORG);
      expect(out).toMatchObject({ id: "q1" });
      expect(newQuoteRepository.create).toHaveBeenCalled();
      expect(linked).not.toHaveBeenCalled();
    });

    it("still rejects a NEW unlinked operator supplied by the caller", async () => {
      vi.mocked(newQuoteRepository.findTourOperatorIds).mockResolvedValue([OP_B]);
      const OP_C = "33333333-3333-4333-8333-333333333333";
      await expect(newQuoteService.duplicateQuote("src", { main_tour_operator_id: OP_C } as never, ORG)).rejects.toMatchObject({ statusCode: 400 });
      expect(newQuoteRepository.create).not.toHaveBeenCalled();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./quote.service", () => ({
  newQuoteService: {
    getQuoteWithDetails: vi.fn(),
    createQuote: vi.fn(),
    duplicateQuote: vi.fn(),
    deleteQuote: vi.fn(),
    listFreeQuotesPaginated: vi.fn(),
    getFreeQuoteStatusCounts: vi.fn(),
    getRecentClientEngagement: vi.fn(),
    setAccepted: vi.fn(),
  },
}));
// These two are imported at module load but unused by the methods under test.
vi.mock("../social-post/social-post.service", () => ({ socialPostService: { uploadMedia: vi.fn() } }));
vi.mock("../notification/push-notification.service", () => ({ pushNotificationService: {} }));

import { quoteController } from "./quote.controller";
import { newQuoteService } from "./quote.service";
import { AppError } from "../../utils/error-handler";

function req(over: Record<string, unknown> = {}) {
  return {
    params: {},
    body: {},
    orgId: "o1",
    branchId: "br1",
    orgRole: "agent",
    orgRoles: ["agent"],
    user: { authType: "password", userId: "u1" },
    ...over,
  } as never;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("quoteController.createQuote — controller-level validation", () => {
  it("rejects with 400 (without calling the service) when transaction_id is missing", async () => {
    const res = mockRes();

    await quoteController.createQuote(req({ body: { sales_price: "100" } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0]).toMatchObject({ success: false });
    expect(newQuoteService.createQuote).not.toHaveBeenCalled();
  });

  it("returns 201 and forwards the body once transaction_id is present", async () => {
    vi.mocked(newQuoteService.createQuote).mockResolvedValue({ id: "q1" } as never);
    const res = mockRes();

    await quoteController.createQuote(req({ body: { transaction_id: "t1" } }), res, vi.fn());

    expect(newQuoteService.createQuote).toHaveBeenCalledWith(
      expect.objectContaining({ transaction_id: "t1" }),
      expect.objectContaining({ orgId: "o1" }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("quoteController.createQuote - source_quote_id (copy to client)", () => {
  it("passes the source quote id as an option and does not leak it into the quote fields", async () => {
    vi.mocked(newQuoteService.createQuote).mockResolvedValue({ id: "q1" } as never);
    await quoteController.createQuote(
      req({ body: { transaction_id: "t1", source_quote_id: "src1", main_tour_operator_id: "op1" } }),
      mockRes(),
      vi.fn(),
    );
    const [data, , options] = vi.mocked(newQuoteService.createQuote).mock.calls[0];
    expect(data).not.toHaveProperty("source_quote_id");
    expect(data).toMatchObject({ main_tour_operator_id: "op1" });
    expect(options).toEqual({ sourceQuoteId: "src1" });
  });
});

describe("quoteController.duplicateQuote", () => {
  it("returns 201 with the duplicated quote", async () => {
    vi.mocked(newQuoteService.duplicateQuote).mockResolvedValue({ id: "q2" } as never);
    const res = mockRes();

    await quoteController.duplicateQuote(req({ params: { id: "q1" }, body: {} }), res, vi.fn());

    expect(newQuoteService.duplicateQuote).toHaveBeenCalledWith("q1", {}, expect.objectContaining({ orgId: "o1" }));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("quoteController.setAccepted", () => {
  it("passes id, flag, user and scope to the service and returns the quote", async () => {
    vi.mocked(newQuoteService.setAccepted).mockResolvedValue({ id: "q1" } as never);
    const res = mockRes();

    await quoteController.setAccepted(req({ params: { id: "q1" }, body: { accepted: true } }), res, vi.fn());

    expect(newQuoteService.setAccepted).toHaveBeenCalledWith("q1", true, "u1", expect.objectContaining({ orgId: "o1" }));
    expect(res.json.mock.calls[0][0]).toMatchObject({ success: true, data: { id: "q1" } });
  });

  it("401s without calling the service when there is no user", async () => {
    const res = mockRes();

    await quoteController.setAccepted(req({ params: { id: "q1" }, body: { accepted: true }, user: undefined }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(newQuoteService.setAccepted).not.toHaveBeenCalled();
  });

  it("forwards a service 404 to next", async () => {
    const err = new AppError("Quote not found", 404);
    vi.mocked(newQuoteService.setAccepted).mockRejectedValue(err);
    const next = vi.fn();

    await quoteController.setAccepted(req({ params: { id: "q1" }, body: { accepted: false } }), mockRes(), next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledWith(err);
  });
});

describe("quoteController.deleteQuote", () => {
  it("returns 204 with no body", async () => {
    vi.mocked(newQuoteService.deleteQuote).mockResolvedValue(undefined as never);
    const res = mockRes();

    await quoteController.deleteQuote(req({ params: { id: "q1" } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledOnce();
  });
});

describe("quoteController — error propagation", () => {
  it("forwards a service error to next", async () => {
    const err = new AppError("Quote not found", 404);
    vi.mocked(newQuoteService.getQuoteWithDetails).mockRejectedValue(err);
    const res = mockRes();
    const next = vi.fn();

    await quoteController.getQuoteById(req({ params: { id: "missing" } }), res, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledWith(err);
  });
});

describe("quoteController.listFreeQuotes — socialStatus param", () => {
  beforeEach(() => {
    vi.mocked(newQuoteService.listFreeQuotesPaginated).mockResolvedValue([] as never);
  });

  it("forwards a valid socialStatus as the last service argument", async () => {
    const res = mockRes();

    await quoteController.listFreeQuotes(req({ query: { socialStatus: "scheduled" } }), res, vi.fn());

    const args = vi.mocked(newQuoteService.listFreeQuotesPaginated).mock.calls[0];
    expect(args[12]).toBe("scheduled");
    expect(res.json.mock.calls[0][0]).toMatchObject({ success: true });
  });

  it("keeps existing params working when socialStatus is absent", async () => {
    await quoteController.listFreeQuotes(
      req({ query: { page: "2", pageSize: "5", search: "rome", tags: "A, B", unscheduledOnly: "true" } }),
      mockRes(),
      vi.fn(),
    );

    const args = vi.mocked(newQuoteService.listFreeQuotesPaginated).mock.calls[0];
    expect(args[0]).toBe(2);
    expect(args[1]).toBe(5);
    expect(args[4]).toBe("rome");
    expect(args[8]).toBe(true);
    expect(args[11]).toEqual(["A", "B"]);
    expect(args[12]).toBeUndefined();
  });
});

describe("quoteController.getFreeQuoteStatusCounts", () => {
  it("returns the counts with search and tags parsed from the query", async () => {
    const counts = { total: 10, not_generated: 4, draft: 3, scheduled: 2, posted: 1 };
    vi.mocked(newQuoteService.getFreeQuoteStatusCounts).mockResolvedValue(counts as never);
    const res = mockRes();

    await quoteController.getFreeQuoteStatusCounts(req({ query: { search: "rome", tags: "Summer, Beach" } }), res, vi.fn());

    const args = vi.mocked(newQuoteService.getFreeQuoteStatusCounts).mock.calls[0];
    expect(args[0]).toBe("rome");
    expect(args[1]).toEqual(["Summer", "Beach"]);
    expect(args[2]).toMatchObject({ orgId: "o1" });
    expect(res.json.mock.calls[0][0]).toMatchObject({ success: true, data: counts });
  });

  it("accepts tags supplied as a repeated query param (array)", async () => {
    vi.mocked(newQuoteService.getFreeQuoteStatusCounts).mockResolvedValue({} as never);

    await quoteController.getFreeQuoteStatusCounts(req({ query: { tags: ["Summer", "Beach"] } }), mockRes(), vi.fn());

    expect(vi.mocked(newQuoteService.getFreeQuoteStatusCounts).mock.calls[0][1]).toEqual(["Summer", "Beach"]);
  });

  it("defaults to empty search and no tags", async () => {
    vi.mocked(newQuoteService.getFreeQuoteStatusCounts).mockResolvedValue({} as never);

    await quoteController.getFreeQuoteStatusCounts(req({ query: {} }), mockRes(), vi.fn());

    const args = vi.mocked(newQuoteService.getFreeQuoteStatusCounts).mock.calls[0];
    expect(args[0]).toBe("");
    expect(args[1]).toEqual([]);
  });
});

describe("quoteController.listRecentClientEngagement — query parsing", () => {
  const call = async (query: Record<string, unknown>) => {
    vi.mocked(newQuoteService.getRecentClientEngagement).mockResolvedValue([] as never);
    await quoteController.listRecentClientEngagement(req({ query }), mockRes(), vi.fn());
    return vi.mocked(newQuoteService.getRecentClientEngagement).mock.lastCall;
  };

  it("with no params: limit 10, mine false, no period (legacy behaviour)", async () => {
    const c = await call({});
    expect(c?.[1]).toBe(10);
    expect(c?.[2]).toEqual({ mine: false, period: undefined });
  });

  it("forwards mine=true and a valid period", async () => {
    const c = await call({ limit: "5", mine: "true", period: "yesterday" });
    expect(c?.[1]).toBe(5);
    expect(c?.[2]).toEqual({ mine: true, period: "yesterday" });
  });

  it("clamps limit to 50, falls back to 10 on junk, and ignores an unknown period", async () => {
    expect((await call({ limit: "500" }))?.[1]).toBe(50);
    expect((await call({ limit: "abc" }))?.[1]).toBe(10);
    expect((await call({ period: "month" }))?.[2]).toEqual({ mine: false, period: undefined });
  });
});

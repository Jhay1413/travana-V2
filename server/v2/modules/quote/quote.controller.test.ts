import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./quote.service", () => ({
  newQuoteService: {
    getQuoteWithDetails: vi.fn(),
    createQuote: vi.fn(),
    duplicateQuote: vi.fn(),
    deleteQuote: vi.fn(),
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

describe("quoteController.duplicateQuote", () => {
  it("returns 201 with the duplicated quote", async () => {
    vi.mocked(newQuoteService.duplicateQuote).mockResolvedValue({ id: "q2" } as never);
    const res = mockRes();

    await quoteController.duplicateQuote(req({ params: { id: "q1" }, body: {} }), res, vi.fn());

    expect(newQuoteService.duplicateQuote).toHaveBeenCalledWith("q1", {}, expect.objectContaining({ orgId: "o1" }));
    expect(res.status).toHaveBeenCalledWith(201);
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

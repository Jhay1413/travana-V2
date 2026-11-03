import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./transaction.service", () => ({
  transactionService: {
    getTransactionWithDetails: vi.fn(),
    createTransaction: vi.fn(),
    createTransactionWithEnquiry: vi.fn(),
    createTransactionWithQuote: vi.fn(),
    createTransactionWithBooking: vi.fn(),
    deleteTransaction: vi.fn(),
    listPipelineByStatus: vi.fn(),
    getPipelineCounts: vi.fn(),
  },
}));
vi.mock("../social-post/social-post.service", () => ({ socialPostService: { uploadMedia: vi.fn() } }));
vi.mock("../../middlewares/auth", () => ({ authStorage: {} }));
vi.mock("../../utils/enum-normalizers", () => ({
  normalizeEnquiry: (x: unknown) => x,
  normalizeQuote: (x: unknown) => x,
  normalizeBooking: (x: unknown) => x,
}));

import { transactionController } from "./transaction.controller";
import { transactionService } from "./transaction.service";
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

describe("transactionController.createTransaction — type dispatch", () => {
  it("routes an enquiry payload to createTransactionWithEnquiry (201)", async () => {
    vi.mocked(transactionService.createTransactionWithEnquiry).mockResolvedValue({ transaction: { id: "t1" } } as never);
    const res = mockRes();

    await transactionController.createTransaction(req({ body: { enquiry: { travel_date: "2026-07-01" } } }), res, vi.fn());

    expect(transactionService.createTransactionWithEnquiry).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("400s a quote payload missing holiday_type_id / travel_date", async () => {
    const res = mockRes();

    await transactionController.createTransaction(req({ body: { quote: { sales_price: "100" } } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(transactionService.createTransactionWithQuote).not.toHaveBeenCalled();
  });

  it("routes a valid quote payload to createTransactionWithQuote (201)", async () => {
    vi.mocked(transactionService.createTransactionWithQuote).mockResolvedValue({ quote: { id: "q1" } } as never);
    const res = mockRes();

    await transactionController.createTransaction(
      req({ body: { quote: { holiday_type_id: "h1", travel_date: "2026-07-01" } } }),
      res,
      vi.fn(),
    );

    expect(transactionService.createTransactionWithQuote).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("400s a booking payload missing required fields", async () => {
    const res = mockRes();

    await transactionController.createTransaction(req({ body: { booking: { hays_ref: "H1" } } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(transactionService.createTransactionWithBooking).not.toHaveBeenCalled();
  });

  it("falls back to a plain transaction when no sub-entity is present (201)", async () => {
    vi.mocked(transactionService.createTransaction).mockResolvedValue({ id: "t1" } as never);
    const res = mockRes();

    await transactionController.createTransaction(req({ body: { status: "on_enquiry" } }), res, vi.fn());

    expect(transactionService.createTransaction).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("transactionController.deleteTransaction", () => {
  it("returns 204 with no body", async () => {
    vi.mocked(transactionService.deleteTransaction).mockResolvedValue(undefined as never);
    const res = mockRes();

    await transactionController.deleteTransaction(req({ params: { id: "t1" } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledOnce();
  });
});

describe("transactionController — error propagation", () => {
  it("forwards a service error to next", async () => {
    const err = new AppError("Transaction not found", 404);
    vi.mocked(transactionService.getTransactionWithDetails).mockRejectedValue(err);
    const res = mockRes();
    const next = vi.fn();

    await transactionController.getTransactionById(req({ params: { id: "missing" } }), res, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledWith(err);
  });
});

describe("transactionController.listPipelineByStatus — filters", () => {
  it("passes an empty filter object when no new params are sent", async () => {
    vi.mocked(transactionService.listPipelineByStatus).mockResolvedValue({ items: [] } as never);

    await transactionController.listPipelineByStatus(req({ params: { status: "quote" }, query: {} }), mockRes(), vi.fn());

    const args = vi.mocked(transactionService.listPipelineByStatus).mock.calls[0];
    expect(args[1]).toBe("quoted");
    expect(args[9]).toEqual({});
  });

  it("parses CSV params, trims search and forwards quick", async () => {
    vi.mocked(transactionService.listPipelineByStatus).mockResolvedValue({ items: [] } as never);
    const query = { search: "  paris ", priority: "low,high", tourOperatorId: "a,b,a", quick: "due_today", sort: "value_desc" };

    await transactionController.listPipelineByStatus(req({ params: { status: "enquiry" }, query }), mockRes(), vi.fn());

    const args = vi.mocked(transactionService.listPipelineByStatus).mock.calls[0];
    expect(args[6]).toBe("value_desc");
    expect(args[9]).toEqual({ search: "paris", priorities: ["low", "high"], tourOperatorIds: ["a", "b"], quick: "due_today" });
  });

  it("treats an empty search as absent", async () => {
    vi.mocked(transactionService.listPipelineByStatus).mockResolvedValue({ items: [] } as never);

    await transactionController.listPipelineByStatus(req({ params: { status: "enquiry" }, query: { search: "" } }), mockRes(), vi.fn());

    expect(vi.mocked(transactionService.listPipelineByStatus).mock.calls[0][9]).toEqual({});
  });
});

describe("transactionController.getPipelineCounts", () => {
  it("parses the filters, never passes quick, and wraps the counts in the envelope", async () => {
    const counts = { all: 3, due_today: 1, no_task: 1, quiet_7: 0 };
    vi.mocked(transactionService.getPipelineCounts).mockResolvedValue(counts);
    const res = mockRes();

    await transactionController.getPipelineCounts(
      req({ query: { agentId: "a1", search: "x", priority: "high", tourOperatorId: "t1,t2", quick: "no_task" } }),
      res,
      vi.fn(),
    );

    expect(vi.mocked(transactionService.getPipelineCounts).mock.calls[0][1]).toEqual({
      agentId: "a1",
      branchId: undefined,
      search: "x",
      priorities: ["high"],
      tourOperatorIds: ["t1", "t2"],
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: counts }));
  });
});

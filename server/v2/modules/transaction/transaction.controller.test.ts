import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./transaction.service", () => ({
  transactionService: {
    getTransactionWithDetails: vi.fn(),
    createTransaction: vi.fn(),
    createTransactionWithEnquiry: vi.fn(),
    createTransactionWithQuote: vi.fn(),
    createTransactionWithBooking: vi.fn(),
    deleteTransaction: vi.fn(),
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

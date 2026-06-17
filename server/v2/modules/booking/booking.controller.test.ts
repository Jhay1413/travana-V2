import { describe, it, expect, vi, beforeEach } from "vitest";

// Only the service is mocked — getScope / successResponse / asyncHandler are the
// real (thin) plumbing, so these tests exercise the actual HTTP translation.
vi.mock("./booking.service", () => ({
  bookingService: {
    getBookingWithDetails: vi.fn(),
    createBooking: vi.fn(),
    convertQuoteToBooking: vi.fn(),
    updateBooking: vi.fn(),
    deleteBooking: vi.fn(),
  },
}));

import { bookingController } from "./booking.controller";
import { bookingService } from "./booking.service";
import { AppError } from "../../utils/error-handler";

// A request carrying the fields getScope() reads.
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

describe("bookingController.getBookingById", () => {
  it("returns 200 with the success envelope and passes id + scope to the service", async () => {
    vi.mocked(bookingService.getBookingWithDetails).mockResolvedValue({ id: "b1" } as never);
    const res = mockRes();

    await bookingController.getBookingById(req({ params: { id: "b1" } }), res, vi.fn());

    expect(bookingService.getBookingWithDetails).toHaveBeenCalledWith("b1", expect.objectContaining({ orgId: "o1" }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: { id: "b1" } }));
  });
});

describe("bookingController.createBooking", () => {
  it("returns 201 and forwards the request body", async () => {
    vi.mocked(bookingService.createBooking).mockResolvedValue({ id: "b1" } as never);
    const res = mockRes();

    await bookingController.createBooking(req({ body: { transaction_id: "t1" } }), res, vi.fn());

    expect(bookingService.createBooking).toHaveBeenCalledWith({ transaction_id: "t1" }, expect.objectContaining({ orgId: "o1" }));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("bookingController.convertQuoteToBooking", () => {
  it("returns 201 and unpacks quoteId param + refs from the body", async () => {
    vi.mocked(bookingService.convertQuoteToBooking).mockResolvedValue({ id: "b1" } as never);
    const res = mockRes();

    await bookingController.convertQuoteToBooking(
      req({ params: { quoteId: "q1" }, body: { haysRef: "H1", supplierRef: "S1" } }),
      res,
      vi.fn(),
    );

    expect(bookingService.convertQuoteToBooking).toHaveBeenCalledWith("q1", "H1", "S1", expect.objectContaining({ orgId: "o1" }));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("bookingController.deleteBooking", () => {
  it("returns 204 with no body", async () => {
    vi.mocked(bookingService.deleteBooking).mockResolvedValue(undefined as never);
    const res = mockRes();

    await bookingController.deleteBooking(req({ params: { id: "b1" } }), res, vi.fn());

    expect(bookingService.deleteBooking).toHaveBeenCalledWith("b1", expect.objectContaining({ orgId: "o1" }));
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledOnce();
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("bookingController — error propagation", () => {
  it("forwards a service AppError to next (→ error middleware), not the response", async () => {
    const err = new AppError("Booking not found", 404);
    vi.mocked(bookingService.getBookingWithDetails).mockRejectedValue(err);
    const res = mockRes();
    const next = vi.fn();

    await bookingController.getBookingById(req({ params: { id: "missing" } }), res, next);
    await Promise.resolve(); // flush asyncHandler's .catch

    expect(next).toHaveBeenCalledWith(err);
    expect(res.json).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextFunction, Request, RequestHandler, Response } from "express";

vi.mock("./portal-auth.service", () => ({ portalAuthService: { verifySession: vi.fn() } }));
vi.mock("./portal-booking-detail.service", () => ({ portalBookingDetailService: { getBooking: vi.fn() } }));

import { portalBookingDetailController } from "./portal-booking-detail.controller";
import { portalBookingDetailValidator } from "./portal-booking-detail.validator";
import { portalAuth, portalErrorHandler } from "./portal.middleware";
import { portalAuthService } from "./portal-auth.service";
import { portalBookingDetailService } from "./portal-booking-detail.service";
import { validate } from "../../middlewares/validation.middleware";
import { AppError } from "../../utils/error-handler";

interface Captured {
  status: number;
  body: unknown;
}

/** Runs a route's handler chain the way Express would, formatting errors with the portal error handler. */
async function call(handlers: RequestHandler[], reqInit: Partial<Request>): Promise<Captured> {
  const req = { headers: { authorization: "Bearer t" }, body: {}, query: {}, params: {}, socket: {}, ...reqInit } as unknown as Request;
  const out: Captured = { status: 200, body: undefined };
  const res = {
    headersSent: false,
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: unknown) {
      out.body = body;
      res.headersSent = true;
      return res;
    },
  } as unknown as Response;
  for (const handler of handlers) {
    let nextErr: unknown;
    let advanced = false;
    const next: NextFunction = (err?: unknown) => {
      advanced = true;
      nextErr = err;
    };
    await handler(req, res, next);
    if (nextErr) {
      portalErrorHandler(nextErr as Error, req, res, vi.fn());
      return out;
    }
    if (!advanced) return out;
  }
  return out;
}

const handlers = [portalAuth, validate(portalBookingDetailValidator), portalBookingDetailController.detail];
const ID = "3f2b8c1e-5d4a-4b7e-9c0d-1a2b3c4d5e6f";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(portalAuthService.verifySession).mockResolvedValue({ clientId: "c1", email: "a@b.com" });
});

describe("GET /bookings/:id", () => {
  it("200 with the booking, asked for as the signed-in customer", async () => {
    vi.mocked(portalBookingDetailService.getBooking).mockResolvedValue({ id: ID } as never);
    const r = await call(handlers, { params: { id: ID } });
    expect(r).toEqual({ status: 200, body: { id: ID } });
    expect(portalBookingDetailService.getBooking).toHaveBeenCalledWith("c1", ID);
  });

  it("404 {error} for a booking that is not theirs", async () => {
    vi.mocked(portalBookingDetailService.getBooking).mockRejectedValue(new AppError("Booking not found", 404));
    expect(await call(handlers, { params: { id: ID } })).toEqual({ status: 404, body: { error: "Booking not found" } });
  });

  it("401 {error} without a valid session, never reaching the service", async () => {
    vi.mocked(portalAuthService.verifySession).mockRejectedValue(new AppError("Unauthorized", 401));
    const r = await call(handlers, { headers: {}, params: { id: ID } });
    expect(r).toEqual({ status: 401, body: { error: "Unauthorized" } });
    expect(portalBookingDetailService.getBooking).not.toHaveBeenCalled();
  });

  it("400 {error} for an id that is not a uuid, without reaching the service", async () => {
    const r = await call(handlers, { params: { id: "not-a-uuid" } });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: expect.any(String) });
    expect(portalBookingDetailService.getBooking).not.toHaveBeenCalled();
  });

  it("500 with the endpoint's own message when something unexpected fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(portalBookingDetailService.getBooking).mockRejectedValue(new Error("db down"));
    expect(await call(handlers, { params: { id: ID } })).toEqual({ status: 500, body: { error: "Failed to load booking" } });
  });
});

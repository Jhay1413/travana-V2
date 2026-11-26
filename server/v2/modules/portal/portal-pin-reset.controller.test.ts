import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextFunction, Request, RequestHandler, Response } from "express";

vi.mock("./portal-pin-reset.service", () => ({
  PIN_RESET_REPLY_MESSAGE: "If we have your details, we've sent you a sign-in link.",
  portalPinResetService: { requestReset: vi.fn() },
}));

import { portalPinResetController } from "./portal-pin-reset.controller";
import { PIN_RESET_REPLY_MESSAGE, portalPinResetService } from "./portal-pin-reset.service";
import { portalErrorHandler } from "./portal.middleware";
import { validate } from "../../middlewares/validation.middleware";
import { portalPinResetValidator } from "./portal-pin-reset.validator";

interface Captured {
  status: number;
  body: unknown;
}

async function call(handlers: RequestHandler[], body: unknown): Promise<Captured> {
  const req = { headers: {}, body, query: {}, params: {} } as unknown as Request;
  const out: Captured = { status: 200, body: undefined };
  const res = {
    headersSent: false,
    status(code: number) {
      out.status = code;
      return res;
    },
    json(b: unknown) {
      out.body = b;
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

const handlers = [validate(portalPinResetValidator), portalPinResetController.requestReset];

beforeEach(() => vi.clearAllMocks());

describe("POST /pin-reset", () => {
  it("returns the same 200 body whatever the service did", async () => {
    vi.mocked(portalPinResetService.requestReset).mockResolvedValue(undefined);
    const found = await call(handlers, { email: "real@example.com" });
    const missing = await call(handlers, { email: "ghost@example.com", org: "nowhere" });
    expect(found).toEqual({ status: 200, body: { success: true, message: PIN_RESET_REPLY_MESSAGE } });
    expect(missing).toEqual(found);
  });

  it("passes the email and agency through (the service trims)", async () => {
    await call(handlers, { email: " Sam@Example.com ", org: "sunny" });
    expect(portalPinResetService.requestReset).toHaveBeenCalledWith({ email: " Sam@Example.com ", org: "sunny" });
  });

  it("rejects a malformed email with a 400 { error } and does nothing", async () => {
    const r = await call(handlers, { email: "not-an-email" });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: expect.any(String) });
    expect(portalPinResetService.requestReset).not.toHaveBeenCalled();
  });

  it("rejects a missing email", async () => {
    const r = await call(handlers, {});
    expect(r.status).toBe(400);
    expect(portalPinResetService.requestReset).not.toHaveBeenCalled();
  });
});

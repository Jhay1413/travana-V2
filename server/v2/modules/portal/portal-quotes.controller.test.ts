import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { AnyZodObject } from "zod";

vi.mock("./portal-auth.service", () => ({ portalAuthService: { verifySession: vi.fn() } }));
vi.mock("./portal-quotes.service", () => ({
  portalQuotesService: { listQuotes: vi.fn(), getQuote: vi.fn(), recordAction: vi.fn(), checkOwnership: vi.fn() },
}));

import { portalQuotesController } from "./portal-quotes.controller";
import { portalAuth, portalErrorHandler } from "./portal.middleware";
import { portalAuthService } from "./portal-auth.service";
import { portalQuotesService } from "./portal-quotes.service";
import { portalQuoteActionValidator, portalQuoteDetailValidator } from "./portal-quotes.validator";
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

const route = (schema: AnyZodObject | null, controller: RequestHandler) => [portalAuth, ...(schema ? [validate(schema)] : []), controller];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(portalAuthService.verifySession).mockResolvedValue({ clientId: "c1", email: "a@b.com" });
});

describe("GET /quotes", () => {
  const handlers = route(null, portalQuotesController.list);

  it("200 with the list for the signed-in customer only", async () => {
    vi.mocked(portalQuotesService.listQuotes).mockResolvedValue([]);
    const r = await call(handlers, {});
    expect(r).toEqual({ status: 200, body: [] });
    expect(portalQuotesService.listQuotes).toHaveBeenCalledWith("c1");
  });

  it("401 {error} without a valid session, never reaching the service", async () => {
    vi.mocked(portalAuthService.verifySession).mockRejectedValue(new AppError("Unauthorized", 401));
    const r = await call(handlers, { headers: {} });
    expect(r).toEqual({ status: 401, body: { error: "Unauthorized" } });
    expect(portalQuotesService.listQuotes).not.toHaveBeenCalled();
  });

  it("500 with the endpoint's own message when something unexpected fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(portalQuotesService.listQuotes).mockRejectedValue(new Error("db down"));
    expect(await call(handlers, {})).toEqual({ status: 500, body: { error: "Failed to load quotes" } });
  });
});

describe("GET /quotes/:token", () => {
  const handlers = route(portalQuoteDetailValidator, portalQuotesController.detail);

  it("200 with the quote, asked for as the signed-in customer", async () => {
    vi.mocked(portalQuotesService.getQuote).mockResolvedValue({ id: "q1" } as never);
    const r = await call(handlers, { params: { token: "TOK1" } });
    expect(r).toEqual({ status: 200, body: { id: "q1" } });
    expect(portalQuotesService.getQuote).toHaveBeenCalledWith("c1", "TOK1");
  });

  it("404 {error} for a quote that is not theirs", async () => {
    vi.mocked(portalQuotesService.getQuote).mockRejectedValue(new AppError("Quote not found", 404));
    expect(await call(handlers, { params: { token: "TOK1" } })).toEqual({ status: 404, body: { error: "Quote not found" } });
  });
});

describe("POST /quotes/:token/action", () => {
  const handlers = route(portalQuoteActionValidator, portalQuotesController.action);
  const decision = { state: "interested", reason: null, note: null, wantsSimilar: null, at: "2026-11-24T10:00:00.000Z" };

  it("200 with the new decision; identity comes from the session even if the body names someone", async () => {
    vi.mocked(portalQuotesService.recordAction).mockResolvedValue({ decision } as never);
    const r = await call(handlers, {
      params: { token: "TOK1" },
      body: { action: "interested", note: "A sea view", customerName: "Someone Else", clientId: "other" },
    });
    expect(r).toEqual({ status: 200, body: { decision } });
    expect(portalQuotesService.recordAction).toHaveBeenCalledWith("c1", "TOK1", { action: "interested", note: "A sea view", reason: undefined, wantsSimilar: undefined });
  });

  it("passes a decline's reason and the similar flag", async () => {
    vi.mocked(portalQuotesService.recordAction).mockResolvedValue({ decision } as never);
    await call(handlers, { params: { token: "TOK1" }, body: { action: "declined", reason: "Too expensive", wantsSimilar: false } });
    expect(portalQuotesService.recordAction).toHaveBeenCalledWith("c1", "TOK1", { action: "declined", note: undefined, reason: "Too expensive", wantsSimilar: false });
  });

  it.each([
    ["an unknown action", { action: "accepted" }],
    ["no action", {}],
    ["a reason outside the list", { action: "declined", reason: "Because" }],
    ["a note over the limit", { action: "interested", note: "x".repeat(1001) }],
    ["a non-boolean similar flag", { action: "declined", wantsSimilar: "yes" }],
  ])("400 {error} for %s, without reaching the service", async (_name, body) => {
    const r = await call(handlers, { params: { token: "TOK1" }, body });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: expect.any(String) });
    expect(portalQuotesService.recordAction).not.toHaveBeenCalled();
  });

  it("404 {error} for another customer's quote", async () => {
    vi.mocked(portalQuotesService.recordAction).mockRejectedValue(new AppError("Quote not found", 404));
    expect(await call(handlers, { params: { token: "TOK1" }, body: { action: "interested" } })).toEqual({ status: 404, body: { error: "Quote not found" } });
  });
});

describe("GET /quote/:token/owns", () => {
  it("answers { found, owns, isPublicDeal } as the old endpoint did", async () => {
    vi.mocked(portalQuotesService.checkOwnership).mockResolvedValue({ found: true, owns: true, isPublicDeal: false });
    const r = await call(route(null, portalQuotesController.owns), { params: { token: "TOK1" } });
    expect(r).toEqual({ status: 200, body: { found: true, owns: true, isPublicDeal: false } });
    expect(portalQuotesService.checkOwnership).toHaveBeenCalledWith("c1", "TOK1");
  });
});

describe("GET /quotes/:token for a booked quote", () => {
  const handlers = route(portalQuoteDetailValidator, portalQuotesController.detail);

  it("410 {error, code: BOOKED, bookingId} for the owner when the service names the booking", async () => {
    vi.mocked(portalQuotesService.getQuote).mockRejectedValue(new AppError("This holiday is booked", 410, true, "BOOKED", { bookingId: "bk-1" }));
    expect(await call(handlers, { params: { token: "TOK1" } })).toEqual({ status: 410, body: { error: "This holiday is booked", code: "BOOKED", bookingId: "bk-1" } });
  });

  it("410 with exactly {error, code} when no single booking is named", async () => {
    vi.mocked(portalQuotesService.getQuote).mockRejectedValue(new AppError("This holiday is booked", 410, true, "BOOKED"));
    expect(await call(handlers, { params: { token: "TOK1" } })).toEqual({ status: 410, body: { error: "This holiday is booked", code: "BOOKED" } });
  });
});

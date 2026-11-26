import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextFunction, Request, RequestHandler, Response } from "express";

vi.mock("./quote-public.service", () => ({
  quotePublicService: { getPublicQuote: vi.fn(), getPreviewQuote: vi.fn(), logView: vi.fn(), logShare: vi.fn() },
}));

import { quotePublicController } from "./quote-public.controller";
import { quotePublicService } from "./quote-public.service";
import { QuoteBlockedError } from "./quote-public.types";
import { shareQuoteSchema } from "./quote-public.validator";
import publicRouter from "./quote-public.routes";
import { validate } from "../../middlewares/validation.middleware";
import { publicQuoteHeaders } from "../../middlewares/public-quote-headers";
import { AppError } from "../../utils/error-handler";

interface Captured {
  status: number;
  body: unknown;
  headers: Record<string, string>;
  next: unknown;
}

async function call(handlers: RequestHandler[], reqInit: Record<string, unknown>): Promise<Captured> {
  const req = { headers: {}, body: {}, query: {}, params: {}, socket: { remoteAddress: "10.0.0.1" }, ...reqInit } as unknown as Request;
  const out: Captured = { status: 200, body: undefined, headers: {}, next: undefined };
  const res = {
    setHeader(name: string, value: string) {
      out.headers[name] = value;
      return res;
    },
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: unknown) {
      out.body = body;
      return res;
    },
  } as unknown as Response;

  for (const handler of handlers) {
    let advanced = false;
    const next: NextFunction = (err?: unknown) => {
      advanced = true;
      out.next = err;
    };
    await handler(req, res, next);
    await new Promise((r) => setImmediate(r));
    if (!advanced || out.next) break;
  }
  return out;
}

beforeEach(() => vi.resetAllMocks());

describe("public quote controller contract", () => {
  it("GET wraps the payload in { success, message, data }", async () => {
    vi.mocked(quotePublicService.getPublicQuote).mockResolvedValue({ title: "T" } as never);
    const out = await call([quotePublicController.getQuote], { params: { token: "ABC234" } });
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ success: true, message: "Success", data: { title: "T" } });
  });

  it("GET a booked quote answers 410 with { error, code, agency } and nothing else", async () => {
    vi.mocked(quotePublicService.getPublicQuote).mockRejectedValue(new QuoteBlockedError({ code: "BOOKED", agency: { name: "Tinas", phone: "0191" } }));
    const out = await call([quotePublicController.getQuote], { params: { token: "ABC234" } });
    expect(out.status).toBe(410);
    expect(out.body).toEqual({ error: "This holiday has been booked.", code: "BOOKED", agency: { name: "Tinas", phone: "0191" } });
    expect(out.next).toBeUndefined();
  });

  it("GET an unknown token goes to the error handler as a 404 AppError", async () => {
    vi.mocked(quotePublicService.getPublicQuote).mockRejectedValue(new AppError("Quote not found", 404));
    const out = await call([quotePublicController.getQuote], { params: { token: "NOPE99" } });
    expect(out.next).toMatchObject({ statusCode: 404, message: "Quote not found" });
  });

  it("view answers { viewId }, classifies the device and uses req.ip, never X-Forwarded-For", async () => {
    vi.mocked(quotePublicService.logView).mockResolvedValue({ id: "v1" } as never);
    const out = await call([quotePublicController.logView], {
      params: { token: "ABC234" },
      ip: "203.0.113.9",
      headers: { "user-agent": "Mozilla/5.0 (iPhone) Safari", "x-forwarded-for": "6.6.6.6" },
    });
    expect(out.body).toEqual({ success: true, message: "Success", data: { viewId: "v1" } });
    expect(quotePublicService.logView).toHaveBeenCalledWith("ABC234", expect.objectContaining({ ipAddress: "203.0.113.9", deviceType: "mobile", browser: "Safari" }));
  });

  it("view of a blocked quote answers 410", async () => {
    vi.mocked(quotePublicService.logView).mockRejectedValue(new QuoteBlockedError({ code: "UNAVAILABLE", agency: { name: null, phone: null } }));
    const out = await call([quotePublicController.logView], { params: { token: "ABC234" }, ip: "1.1.1.1" });
    expect(out.status).toBe(410);
    expect(out.body).toEqual({ error: "This quote is no longer available.", code: "UNAVAILABLE", agency: { name: null, phone: null } });
  });

  it("share answers data: null", async () => {
    vi.mocked(quotePublicService.logShare).mockResolvedValue(undefined);
    const out = await call([quotePublicController.logShare], { params: { token: "ABC234" }, body: { method: "Email" } });
    expect(out.body).toEqual({ success: true, message: "Success", data: null });
    expect(quotePublicService.logShare).toHaveBeenCalledWith("ABC234", "Email");
  });

  it("preview passes the caller's scope and returns the payload", async () => {
    vi.mocked(quotePublicService.getPreviewQuote).mockResolvedValue({ title: "T", previewBlock: "BOOKED" } as never);
    const out = await call([quotePublicController.previewQuote], {
      params: { token: "ABC234" },
      orgId: "o1",
      branchId: "b1",
      orgRole: "agent",
      orgRoles: ["agent"],
    });
    expect(out.body).toEqual({ success: true, message: "Success", data: { title: "T", previewBlock: "BOOKED" } });
    expect(quotePublicService.getPreviewQuote).toHaveBeenCalledWith("ABC234", expect.objectContaining({ orgId: "o1", orgRole: "agent" }));
  });
});

describe("share validation", () => {
  const run = (method: unknown) => call([validate(shareQuoteSchema)], { params: { token: "ABC234" }, body: { method } });

  it("accepts the fixed methods and refuses anything else", async () => {
    expect((await run("WhatsApp")).next).toBeUndefined();
    expect((await run("Copy Link")).next).toBeUndefined();
    expect((await run("<b>x</b>")).next).toMatchObject({ statusCode: 400 });
    expect((await run("x".repeat(5000))).next).toMatchObject({ statusCode: 400 });
    expect((await run(undefined)).next).toMatchObject({ statusCode: 400 });
  });
});

describe("public quote router", () => {
  type Layer = { route?: { path: string; methods: Record<string, boolean> } };
  const routes = (publicRouter as unknown as { stack: Layer[] }).stack
    .filter((l) => l.route)
    .map((l) => `${Object.keys(l.route!.methods)[0].toUpperCase()} ${l.route!.path}`);

  it("serves get, view and share only: the open action endpoint is gone", () => {
    expect([...routes].sort()).toEqual(["GET /:token", "POST /:token/share", "POST /:token/view"]);
  });
});

describe("publicQuoteHeaders", () => {
  it("sets no-store, noindex and no-referrer", async () => {
    const out = await call([publicQuoteHeaders], {});
    expect(out.headers).toEqual({
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    });
  });
});

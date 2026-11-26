import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextFunction, Request, RequestHandler, Response } from "express";

vi.mock("./portal-auth.service", () => ({ portalAuthService: { verifySession: vi.fn() } }));
vi.mock("./portal-summary.service", () => ({ portalSummaryService: { getSummary: vi.fn() } }));

import { portalSummaryController } from "./portal-summary.controller";
import { portalSummaryRouter } from "./portal-summary.routes";
import { portalAuth, portalErrorHandler } from "./portal.middleware";
import { portalAuthService } from "./portal-auth.service";
import { portalSummaryService } from "./portal-summary.service";
import { AppError } from "../../utils/error-handler";

interface Captured {
  status: number;
  body: unknown;
}

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

const handlers = [portalAuth, portalSummaryController.summary];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(portalAuthService.verifySession).mockResolvedValue({ clientId: "c1", email: "a@b.com" });
});

describe("GET /summary", () => {
  it("is mounted as GET /summary behind the portal session, and nothing else", () => {
    const layers = (portalSummaryRouter.stack as Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: RequestHandler }> } }>).filter((l) => l.route);
    expect(layers).toHaveLength(1);
    expect(layers[0].route?.path).toBe("/summary");
    expect(layers[0].route?.methods).toEqual({ get: true });
    expect(layers[0].route?.stack.map((s) => s.handle)).toEqual([portalAuth, portalSummaryController.summary]);
  });

  it("200 with the summary for the signed-in customer; the request cannot name another", async () => {
    const summary = { firstName: "Pat", counts: { quotesAwaiting: 1, upcomingBookings: 0 }, nextBooking: null, priceHeld: null, rewards: { walletCredit: 0, rewardWaiting: false } };
    vi.mocked(portalSummaryService.getSummary).mockResolvedValue(summary);
    const r = await call(handlers, { query: { clientId: "other" }, params: { clientId: "other" }, body: { clientId: "other" } });
    expect(r).toEqual({ status: 200, body: summary });
    expect(portalSummaryService.getSummary).toHaveBeenCalledWith("c1");
  });

  it("401 {error} without a valid session, never reaching the service", async () => {
    vi.mocked(portalAuthService.verifySession).mockRejectedValue(new AppError("Unauthorized", 401));
    const r = await call(handlers, { headers: {} });
    expect(r).toEqual({ status: 401, body: { error: "Unauthorized" } });
    expect(portalSummaryService.getSummary).not.toHaveBeenCalled();
  });

  it("500 with the endpoint's own message when something unexpected fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(portalSummaryService.getSummary).mockRejectedValue(new Error("db down"));
    expect(await call(handlers, {})).toEqual({ status: 500, body: { error: "Failed to load your summary" } });
  });
});

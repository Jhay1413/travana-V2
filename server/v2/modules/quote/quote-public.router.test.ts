import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

vi.mock("./quote-public.service", () => ({
  quotePublicService: { getPublicQuote: vi.fn(), getPreviewQuote: vi.fn(), logView: vi.fn(), logShare: vi.fn() },
}));

import publicRouter from "./quote-public.routes";
import { quotePublicService } from "./quote-public.service";
import { QuoteBlockedError } from "./quote-public.types";
import { AppError } from "../../utils/error-handler";
// The error handler server/index.ts actually installs after the router (it only knows the v1 AppError class).
import { errorHandler as appErrorHandler } from "../../../middlewares/error.middleware";

/** The real router mounted the way server/index.ts mounts it, with the app's own error handler behind it. */
let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/public/quote", publicRouter);
  // Stand-in for the SPA catch-all that answers any other path with a page.
  app.use((_req, res) => res.status(200).send("<html></html>"));
  app.use(appErrorHandler);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/public/quote`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => vi.resetAllMocks());

const post = (path: string, body: unknown) =>
  fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("public quote router: every error path through the real mounted router", () => {
  it("unknown token: 404 with the error body", async () => {
    vi.mocked(quotePublicService.getPublicQuote).mockRejectedValue(new AppError("Quote not found", 404));
    const res = await fetch(`${base}/NOPE99`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ success: false, message: "Quote not found" });
  });

  it("booked: 410 with exactly { error, code, agency }", async () => {
    vi.mocked(quotePublicService.getPublicQuote).mockRejectedValue(new QuoteBlockedError({ code: "BOOKED", agency: { name: "Tinas", phone: null, logoUrl: null, iconUrl: null, email: null, address: null } }));
    const res = await fetch(`${base}/ABC234`);
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: "This holiday has been booked.", code: "BOOKED", agency: { name: "Tinas", phone: null, logoUrl: null, iconUrl: null, email: null, address: null } });
  });

  it("unavailable on view and share: 410", async () => {
    const blocked = new QuoteBlockedError({ code: "UNAVAILABLE", agency: { name: null, phone: null, logoUrl: null, iconUrl: null, email: null, address: null } });
    vi.mocked(quotePublicService.logView).mockRejectedValue(blocked);
    vi.mocked(quotePublicService.logShare).mockRejectedValue(blocked);
    expect((await post("/ABC234/view", {})).status).toBe(410);
    const share = await post("/ABC234/share", { method: "Email" });
    expect(share.status).toBe(410);
    expect(((await share.json()) as { code: string }).code).toBe("UNAVAILABLE");
  });

  it.each(["<b>x</b>", "x".repeat(500), "whatsapp", ""])("invalid share method %#: 400, never reaches the service", async (method) => {
    const res = await post("/ABC234/share", { method });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { success: boolean }).success).toBe(false);
    expect(quotePublicService.logShare).not.toHaveBeenCalled();
  });

  it("a missing share body: 400", async () => {
    expect((await post("/ABC234/share", {})).status).toBe(400);
  });

  it("the removed action endpoint and any other unmatched path under the prefix: 404, not the page", async () => {
    expect((await post("/ABC234/action", { actionType: "accepted" })).status).toBe(404);
    expect((await fetch(`${base}/ABC234/anything/else`)).status).toBe(404);
    expect((await fetch(`${base}/`)).status).toBe(404);
  });

  it("an unexpected failure is a 500 with no detail", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(quotePublicService.getPublicQuote).mockRejectedValue(new Error("db exploded"));
    const res = await fetch(`${base}/ABC234`);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("exploded");
    spy.mockRestore();
  });

  it("repeated views past the per-token limit answer 429 with a readable body", async () => {
    vi.mocked(quotePublicService.logView).mockResolvedValue({ id: "v1" } as never);
    let last: Response | undefined;
    for (let i = 0; i < 31; i++) last = await post("/LIMIT1/view", {});
    expect(last!.status).toBe(429);
    const body = (await last!.json()) as { success: boolean; message: string };
    expect(body.success).toBe(false);
    expect(body.message.length).toBeGreaterThan(5);
    expect(last!.headers.get("retry-after")).toBeTruthy();
  });

  it("every response carries the no-store, noindex and no-referrer headers", async () => {
    vi.mocked(quotePublicService.getPublicQuote).mockResolvedValue({ title: "T" } as never);
    const res = await fetch(`${base}/ABC234`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect((await fetch(`${base}/ABC234/action`)).headers.get("cache-control")).toBe("no-store");
  });
});

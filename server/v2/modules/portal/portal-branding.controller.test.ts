import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextFunction, Request, RequestHandler, Response } from "express";

vi.mock("./portal-branding.service", () => ({
  portalBrandingService: { getForSlug: vi.fn(), getForClient: vi.fn() },
}));
vi.mock("./portal-auth.service", () => ({ portalAuthService: { verifySession: vi.fn() } }));

import { portalBrandingController } from "./portal-branding.controller";
import { portalBrandingService } from "./portal-branding.service";
import { portalAuth, portalErrorHandler } from "./portal.middleware";
import { portalAuthService } from "./portal-auth.service";
import { validate } from "../../middlewares/validation.middleware";
import { portalBrandingBySlugValidator } from "./portal-branding.validator";
import { AppError } from "../../utils/error-handler";

interface Captured {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

async function call(handlers: RequestHandler[], reqInit: Partial<Request>): Promise<Captured> {
  const req = { headers: {}, body: {}, query: {}, params: {}, ...reqInit } as unknown as Request;
  const out: Captured = { status: 200, body: undefined, headers: {} };
  const res = {
    headersSent: false,
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

const branding = { name: "Sunny Travel", logoUrl: null, iconUrl: null, brandColor: "#1a5fb4", phone: null, email: null, address: null };

beforeEach(() => vi.clearAllMocks());

describe("GET /branding/:slug", () => {
  const handlers = [validate(portalBrandingBySlugValidator), portalBrandingController.forSlug];

  it("200 with the branding and a public cache header", async () => {
    vi.mocked(portalBrandingService.getForSlug).mockResolvedValue(branding);
    const r = await call(handlers, { params: { slug: "sunny" } });
    expect(r.status).toBe(200);
    expect(r.body).toEqual(branding);
    expect(r.headers["Cache-Control"]).toContain("public");
    expect(portalBrandingService.getForSlug).toHaveBeenCalledWith("sunny");
  });

  it("is public: no session is needed", async () => {
    vi.mocked(portalBrandingService.getForSlug).mockResolvedValue(branding);
    await call(handlers, { params: { slug: "sunny" } });
    expect(portalAuthService.verifySession).not.toHaveBeenCalled();
  });

  it("an over-long slug is a 400 in the portal's { error } shape", async () => {
    const r = await call(handlers, { params: { slug: "a".repeat(101) } });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: expect.any(String) });
  });

  it("a service failure becomes a 500 { error }", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(portalBrandingService.getForSlug).mockRejectedValue(new Error("db down"));
    const r = await call(handlers, { params: { slug: "sunny" } });
    expect(r).toMatchObject({ status: 500, body: { error: "Failed to load branding" } });
  });
});

describe("GET /branding (signed in)", () => {
  const handlers = [portalAuth, portalBrandingController.forSession];

  it("401 without a valid session", async () => {
    vi.mocked(portalAuthService.verifySession).mockRejectedValue(new AppError("Unauthorized", 401));
    const r = await call(handlers, {});
    expect(r).toMatchObject({ status: 401, body: { error: "Unauthorized" } });
    expect(portalBrandingService.getForClient).not.toHaveBeenCalled();
  });

  it("200 for the session's own customer, never cached publicly", async () => {
    vi.mocked(portalAuthService.verifySession).mockResolvedValue({ clientId: "c1", email: "a@b.com" });
    vi.mocked(portalBrandingService.getForClient).mockResolvedValue({ ...branding, agentName: "Jo" });
    const r = await call(handlers, { headers: { authorization: "Bearer x" } });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ...branding, agentName: "Jo" });
    expect(r.headers["Cache-Control"]).toBe("private, no-store");
    expect(portalBrandingService.getForClient).toHaveBeenCalledWith("c1");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextFunction, Request, RequestHandler, Response } from "express";

vi.mock("./portal.repository", () => ({
  portalRepository: {
    findWebauthnCredentialsForClient: vi.fn(),
    deleteWebauthnCredentialForClient: vi.fn(),
  },
}));
vi.mock("./portal-auth.service", () => ({ portalAuthService: { verifySession: vi.fn() } }));
vi.mock("./portal-deals.service", () => ({ portalDealsService: {} }));
vi.mock("./portal-bookings.service", () => ({ portalBookingsService: {} }));
vi.mock("./portal.service", () => ({ portalService: {} }));

import { portalWebauthnService } from "./portal-webauthn.service";
import { portalRepository } from "./portal.repository";
import { portalController } from "./portal.controller";
import { portalAuth, portalErrorHandler } from "./portal.middleware";
import { portalAuthService } from "./portal-auth.service";
import { validate } from "../../middlewares/validation.middleware";
import { portalWebauthnRemoveValidator } from "./portal.validator";
import { AppError } from "../../utils/error-handler";

const repo = vi.mocked(portalRepository);
const ID = "11111111-2222-4333-8444-555555555555";

beforeEach(() => vi.clearAllMocks());

describe("portalWebauthnService.listCredentials", () => {
  it("returns id, credential id and the created date as ISO text, and nothing else", async () => {
    repo.findWebauthnCredentialsForClient.mockResolvedValue([
      { id: ID, credentialId: "cred-1", createdAt: new Date("2026-11-01T10:00:00Z") },
      { id: "x", credentialId: "cred-2", createdAt: null },
    ]);
    expect(await portalWebauthnService.listCredentials("c1")).toEqual([
      { id: ID, credentialId: "cred-1", createdAt: "2026-11-01T10:00:00.000Z" },
      { id: "x", credentialId: "cred-2", createdAt: null },
    ]);
    expect(repo.findWebauthnCredentialsForClient).toHaveBeenCalledWith("c1");
  });
});

describe("portalWebauthnService.removeCredential", () => {
  it("deletes only within the signed-in customer's own credentials", async () => {
    await portalWebauthnService.removeCredential("c1", ID);
    expect(repo.deleteWebauthnCredentialForClient).toHaveBeenCalledWith("c1", ID);
  });
  it("a malformed id is a quiet no-op (no query, no error)", async () => {
    await expect(portalWebauthnService.removeCredential("c1", "not-a-uuid")).resolves.toBeUndefined();
    expect(repo.deleteWebauthnCredentialForClient).not.toHaveBeenCalled();
  });
});

async function call(handlers: RequestHandler[], reqInit: Partial<Request>): Promise<{ status: number; body: unknown }> {
  const req = { headers: { authorization: "Bearer t" }, body: {}, query: {}, params: {}, ...reqInit } as unknown as Request;
  const out = { status: 200, body: undefined as unknown };
  const res = {
    headersSent: false,
    status(c: number) { out.status = c; return res; },
    json(b: unknown) { out.body = b; res.headersSent = true; return res; },
  } as unknown as Response;
  for (const h of handlers) {
    let err: unknown;
    let advanced = false;
    const next: NextFunction = (e?: unknown) => { advanced = true; err = e; };
    await h(req, res, next);
    if (err) { portalErrorHandler(err as Error, req, res, vi.fn()); return out; }
    if (!advanced) return out;
  }
  return out;
}

describe("DELETE /webauthn/credentials/:id", () => {
  const handlers = [portalAuth, validate(portalWebauthnRemoveValidator), portalController.webauthnRemove];

  it("401 without a session and deletes nothing", async () => {
    vi.mocked(portalAuthService.verifySession).mockRejectedValue(new AppError("Unauthorized", 401));
    const r = await call(handlers, { params: { id: ID } });
    expect(r.status).toBe(401);
    expect(repo.deleteWebauthnCredentialForClient).not.toHaveBeenCalled();
  });

  it("the same { success: true } whether the credential existed, belonged to someone else, or the id is junk", async () => {
    vi.mocked(portalAuthService.verifySession).mockResolvedValue({ clientId: "c1", email: "a@b.com" });
    const real = await call(handlers, { params: { id: ID } });
    const missing = await call(handlers, { params: { id: "99999999-2222-4333-8444-555555555555" } });
    const junk = await call(handlers, { params: { id: "nope" } });
    expect(real).toEqual({ status: 200, body: { success: true } });
    expect(missing).toEqual(real);
    expect(junk).toEqual(real);
    // Always scoped to the session's own customer, never to a caller-supplied one.
    expect(repo.deleteWebauthnCredentialForClient).toHaveBeenCalledWith("c1", ID);
    expect(repo.deleteWebauthnCredentialForClient).toHaveBeenCalledTimes(2);
  });

  it("the validator only bounds the id's length", () => {
    expect(portalWebauthnRemoveValidator.safeParse({ params: { id: "x".repeat(65) } }).success).toBe(false);
    expect(portalWebauthnRemoveValidator.safeParse({ params: { id: "" } }).success).toBe(false);
    expect(portalWebauthnRemoveValidator.safeParse({ params: { id: ID } }).success).toBe(true);
  });
});

describe("GET /webauthn/credentials", () => {
  it("lists only the session's own credentials", async () => {
    vi.mocked(portalAuthService.verifySession).mockResolvedValue({ clientId: "c7", email: "a@b.com" });
    repo.findWebauthnCredentialsForClient.mockResolvedValue([]);
    const r = await call([portalAuth, portalController.webauthnCredentials], {});
    expect(r).toEqual({ status: 200, body: [] });
    expect(repo.findWebauthnCredentialsForClient).toHaveBeenCalledWith("c7");
  });
});

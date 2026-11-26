import { describe, it, expect, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { createClientRateLimiter } from "./portal-client-rate-limit";

const run = (limiter: ReturnType<typeof createClientRateLimiter>, clientId: string | null) => {
  const out = { status: 0, body: undefined as unknown, nexted: false };
  const req = (clientId ? { portalClient: { clientId, email: "" } } : {}) as unknown as Request;
  const res = {
    setHeader: vi.fn(),
    status: (c: number) => { out.status = c; return res; },
    json: (b: unknown) => { out.body = b; return res; },
  } as unknown as Response;
  limiter(req, res, (() => { out.nexted = true; }) as NextFunction);
  return out;
};

describe("createClientRateLimiter", () => {
  it("limits per signed-in customer, not per address: one customer hitting the cap does not block another", () => {
    const limiter = createClientRateLimiter({ max: 2, windowMs: 60_000, message: "slow down" });
    expect(run(limiter, "a").nexted).toBe(true);
    expect(run(limiter, "a").nexted).toBe(true);
    const blocked = run(limiter, "a");
    expect(blocked).toMatchObject({ nexted: false, status: 429, body: { error: "slow down" } });
    expect(run(limiter, "b").nexted).toBe(true);
  });

  it("lets a request with no portal session straight through (auth answers it)", () => {
    expect(run(createClientRateLimiter({ max: 1, windowMs: 1000, message: "x" }), null).nexted).toBe(true);
  });
});

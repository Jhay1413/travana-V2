import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { createRateLimiter } from "./rate-limit.middleware";

function mockRes() {
  const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe("createRateLimiter", () => {
  it("allows up to max requests then responds 429 with a message", () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 60_000 });
    const req = { ip: "1.1.1.1" } as Request;
    const next = vi.fn();

    limiter(req, mockRes() as unknown as Response, next);
    limiter(req, mockRes() as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(2);

    const res = mockRes();
    limiter(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it("tracks IPs independently", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
    const next = vi.fn();
    limiter({ ip: "1.1.1.1" } as Request, mockRes() as unknown as Response, next);
    limiter({ ip: "2.2.2.2" } as Request, mockRes() as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(2);
  });
});

describe("createRateLimiter onLimit (custom 429 reply)", () => {
  function run(limiter: ReturnType<typeof createRateLimiter>, ip: string) {
    const out = { status: 0, body: undefined as unknown, headers: {} as Record<string, string>, nexted: false };
    const res = {
      setHeader: (k: string, v: string) => { out.headers[k] = v; },
      status: (c: number) => { out.status = c; return res; },
      json: (b: unknown) => { out.body = b; return res; },
    };
    limiter({ ip } as never, res as never, () => { out.nexted = true; });
    return out;
  }

  it("uses the custom formatter when given, still setting Retry-After, and does not call next", () => {
    const limiter = createRateLimiter({
      max: 1, windowMs: 60_000,
      onLimit: (res, seconds) => { res.status(429).json({ error: `wait ${seconds}` }); },
    });
    run(limiter, "1.1.1.1");
    const blocked = run(limiter, "1.1.1.1");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: expect.stringMatching(/^wait \d+$/) });
    expect(blocked.headers["Retry-After"]).toBeDefined();
    expect(blocked.nexted).toBe(false);
  });

  it("without a formatter the staff envelope is unchanged", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000, message: "slow down" });
    run(limiter, "2.2.2.2");
    const blocked = run(limiter, "2.2.2.2");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ success: false, message: "slow down" });
  });
});

describe("createRateLimiter keyFn", () => {
  const res = () => ({ setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() }) as unknown as Response;

  it("buckets by the returned key instead of the IP, and skips a null key", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000, keyFn: (req) => (req.params.token as string | undefined) ?? null });
    const next = vi.fn();
    limiter({ ip: "1.1.1.1", params: { token: "A" } } as unknown as Request, res(), next);
    limiter({ ip: "2.2.2.2", params: { token: "B" } } as unknown as Request, res(), next);
    expect(next).toHaveBeenCalledTimes(2);
    const blocked = res();
    limiter({ ip: "3.3.3.3", params: { token: "A" } } as unknown as Request, blocked, next);
    expect(blocked.status).toHaveBeenCalledWith(429);
    limiter({ ip: "1.1.1.1", params: {} } as unknown as Request, res(), next);
    limiter({ ip: "1.1.1.1", params: {} } as unknown as Request, res(), next);
    expect(next).toHaveBeenCalledTimes(4);
  });
});

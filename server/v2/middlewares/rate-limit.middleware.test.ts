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

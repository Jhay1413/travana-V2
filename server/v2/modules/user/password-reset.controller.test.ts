import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("./password-reset.service", () => ({
  passwordResetService: { requestReset: vi.fn(), resetPassword: vi.fn() },
}));

import { passwordResetController, FORGOT_PASSWORD_REPLY } from "./password-reset.controller";
import { forgotPasswordSchema, resetPasswordSchema } from "./password-reset.validator";
import { passwordResetService } from "./password-reset.service";

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

function forgotReq(body: unknown) {
  return { body, get: (h: string) => (h === "origin" ? "http://localhost:5055" : undefined), protocol: "http" } as unknown as Request;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => vi.resetAllMocks());

describe("forgotPassword controller", () => {
  it("replies before the reset work has finished (same timing for known and unknown emails)", async () => {
    vi.mocked(passwordResetService.requestReset).mockReturnValue(new Promise<void>(() => undefined));
    const res = mockRes();
    const next = vi.fn();
    passwordResetController.forgotPassword(forgotReq({ email: "A@b.com" }), res as unknown as Response, next);
    await flush();
    expect(res.json).toHaveBeenCalledWith({ message: FORGOT_PASSWORD_REPLY });
    expect(passwordResetService.requestReset).toHaveBeenCalledWith("A@b.com", "http://localhost:5055");
    expect(next).not.toHaveBeenCalled();
  });

  it("gives the identical reply when the background work fails, logging without the email", async () => {
    vi.mocked(passwordResetService.requestReset).mockRejectedValueOnce(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = mockRes();
    passwordResetController.forgotPassword(forgotReq({ email: "a@b.com" }), res as unknown as Response, vi.fn());
    await flush();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: FORGOT_PASSWORD_REPLY });
    expect(spy).toHaveBeenCalledWith("Forgot password error:", "db down");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("a@b.com");
    spy.mockRestore();
  });
});

describe("resetPassword controller", () => {
  it("passes the token and password to the service and confirms", async () => {
    const res = mockRes();
    passwordResetController.resetPassword({ body: { token: "t", password: "longenough" } } as unknown as Request, res as unknown as Response, vi.fn());
    await flush();
    expect(passwordResetService.resetPassword).toHaveBeenCalledWith("t", "longenough");
    expect(res.json).toHaveBeenCalledWith({ message: "Password has been reset successfully" });
  });

  it("hands a service error to the error middleware", async () => {
    const boom = new Error("expired");
    vi.mocked(passwordResetService.resetPassword).mockRejectedValueOnce(boom);
    const res = mockRes();
    const next = vi.fn();
    passwordResetController.resetPassword({ body: { token: "t", password: "longenough" } } as unknown as Request, res as unknown as Response, next);
    await flush();
    expect(next).toHaveBeenCalledWith(boom);
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("password reset validators", () => {
  it("forgot: needs an email string but does not judge its format", () => {
    expect(forgotPasswordSchema.safeParse({ body: { email: "a@b.com" } }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ body: { email: "not-an-email" } }).success).toBe(true);
    for (const body of [{}, { email: "" }, { email: "   " }, { email: 5 }, { email: null }]) {
      const parsed = forgotPasswordSchema.safeParse({ body });
      expect(parsed.success).toBe(false);
      expect(parsed.success ? "" : parsed.error.errors[0]!.message).toBe("Email is required");
    }
  });

  it("reset: needs a token and a password of at least 6 characters", () => {
    expect(resetPasswordSchema.safeParse({ body: { token: "t", password: "longenough" } }).success).toBe(true);
    for (const body of [{ token: "t" }, { password: "longenough" }, { token: "", password: "x" }, { token: 1, password: "longenough" }]) {
      const parsed = resetPasswordSchema.safeParse({ body });
      expect(parsed.success).toBe(false);
      expect(parsed.success ? "" : parsed.error.errors[0]!.message).toBe("Token and password are required");
    }
    const short = resetPasswordSchema.safeParse({ body: { token: "t", password: "abc" } });
    expect(short.success ? "" : short.error.errors[0]!.message).toBe("Password must be at least 6 characters");
  });
});

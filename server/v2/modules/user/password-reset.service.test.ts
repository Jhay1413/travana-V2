import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const providerSend = vi.hoisted(() => vi.fn());
const providerName = vi.hoisted(() => ({ value: "resend" }));
vi.mock("../../../services/email-provider", () => ({
  getEmailProvider: () => ({ name: providerName.value, send: providerSend }),
  isRealEmailProvider: (p: { name: string }) => p.name !== "console",
}));
vi.mock("./user-session.repository", () => ({ userSessionRepository: { deleteByUserId: vi.fn() } }));
vi.mock("../../utils/public-url", () => ({ getPublicBaseUrl: () => "https://app.travana.co.uk" }));
vi.mock("./user.repository", () => ({
  userRepository: { findByEmail: vi.fn(), findByResetToken: vi.fn(), updatePartial: vi.fn() },
}));

import { passwordResetService, buildResetUrl } from "./password-reset.service";
import { userRepository } from "./user.repository";
import { userSessionRepository } from "./user-session.repository";
import { AppError } from "../../utils/error-handler";

const originalEnv = { ...process.env };
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.REPLIT_DEPLOYMENT;
  delete process.env.REPLIT_DEPLOYMENT_ID;
  process.env.NODE_ENV = "test";
  providerName.value = "resend";
});
afterEach(() => {
  process.env = { ...originalEnv };
});

describe("buildResetUrl", () => {
  it("uses the request origin outside production", () => {
    expect(buildResetUrl("tok", "http://localhost:5055")).toBe("http://localhost:5055/reset-password/tok");
  });
  it("uses the configured URL in production, ignoring the request origin", () => {
    process.env.NODE_ENV = "production";
    expect(buildResetUrl("tok", "https://evil.example")).toBe("https://app.travana.co.uk/reset-password/tok");
  });
});

describe("requestReset", () => {
  it("does nothing for an unknown email", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(undefined);
    await passwordResetService.requestReset("nobody@x.com");
    expect(userRepository.updatePartial).not.toHaveBeenCalled();
    expect(providerSend).not.toHaveBeenCalled();
  });

  it("stores a one-hour token and emails the reset link", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue({ id: "u1", email: "a@b.com", name: "Ann <b>" } as never);
    const before = Date.now();
    await passwordResetService.requestReset(" A@B.com ", "http://localhost:5055");
    await flush();

    expect(userRepository.findByEmail).toHaveBeenCalledWith("a@b.com");
    const patch = vi.mocked(userRepository.updatePartial).mock.calls[0]![1] as { resetToken: string; resetTokenExpiry: Date };
    expect(patch.resetToken).toMatch(/^[0-9a-f]{64}$/);
    expect(patch.resetTokenExpiry.getTime()).toBeGreaterThanOrEqual(before + 60 * 60 * 1000);
    expect(patch.resetTokenExpiry.getTime()).toBeLessThanOrEqual(Date.now() + 60 * 60 * 1000);

    const mail = providerSend.mock.calls[0]![0] as { to: string; text: string; html: string };
    expect(mail.to).toBe("a@b.com");
    expect(mail.text).toContain(`http://localhost:5055/reset-password/${patch.resetToken}`);
    expect(mail.html).toContain("Ann &lt;b&gt;");
  });

  it("survives a send failure and logs neither the token nor the link", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue({ id: "u1", email: "a@b.com", name: "Ann" } as never);
    providerSend.mockRejectedValue(new Error("provider down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(passwordResetService.requestReset("a@b.com")).resolves.toBeUndefined();
    await flush();

    const token = (vi.mocked(userRepository.updatePartial).mock.calls[0]![1] as { resetToken: string }).resetToken;
    const logged = JSON.stringify([...errSpy.mock.calls, ...logSpy.mock.calls]);
    expect(errSpy).toHaveBeenCalled();
    expect(logged).not.toContain(token);
    expect(logged).not.toContain("reset-password");
    errSpy.mockRestore();
    logSpy.mockRestore();
  });
});

describe("requestReset in production without a real email provider", () => {
  it("does not send, and logs an error that carries no token or link", async () => {
    process.env.NODE_ENV = "production";
    providerName.value = "console";
    vi.mocked(userRepository.findByEmail).mockResolvedValue({ id: "u1", email: "a@b.com", name: "Ann" } as never);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(passwordResetService.requestReset("a@b.com")).resolves.toBeUndefined();
    await flush();

    const token = (vi.mocked(userRepository.updatePartial).mock.calls[0]![1] as { resetToken: string }).resetToken;
    expect(providerSend).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledOnce();
    const logged = JSON.stringify([...errSpy.mock.calls, ...logSpy.mock.calls]);
    expect(logged).not.toContain(token);
    expect(logged).not.toContain("reset-password");
    expect(logged).not.toContain("a@b.com");
    errSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("still sends through a real provider in production", async () => {
    process.env.NODE_ENV = "production";
    vi.mocked(userRepository.findByEmail).mockResolvedValue({ id: "u1", email: "a@b.com", name: "Ann" } as never);
    await passwordResetService.requestReset("a@b.com");
    await flush();
    expect(providerSend).toHaveBeenCalledOnce();
  });

  it("keeps the console behaviour outside production", async () => {
    providerName.value = "console";
    vi.mocked(userRepository.findByEmail).mockResolvedValue({ id: "u1", email: "a@b.com", name: "Ann" } as never);
    await passwordResetService.requestReset("a@b.com", "http://localhost:5055");
    await flush();
    expect(providerSend).toHaveBeenCalledOnce();
  });
});

describe("resetPassword", () => {
  it("rejects a short password before touching the database", async () => {
    await expect(passwordResetService.resetPassword("t", "abc")).rejects.toMatchObject({ statusCode: 400 });
    expect(userRepository.findByResetToken).not.toHaveBeenCalled();
  });

  it("rejects an unknown or already-used token", async () => {
    vi.mocked(userRepository.findByResetToken).mockResolvedValue(undefined);
    const err = await passwordResetService.resetPassword("used", "longenough").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).message).toBe("Invalid or expired reset link");
    expect(userRepository.updatePartial).not.toHaveBeenCalled();
  });

  it("rejects an expired token and leaves the password alone", async () => {
    vi.mocked(userRepository.findByResetToken).mockResolvedValue({ id: "u1", resetTokenExpiry: new Date(Date.now() - 1000) } as never);
    await expect(passwordResetService.resetPassword("t", "longenough")).rejects.toThrow("Reset link has expired");
    expect(userRepository.updatePartial).not.toHaveBeenCalled();
  });

  it("sets a hashed password and clears the token", async () => {
    vi.mocked(userRepository.findByResetToken).mockResolvedValue({ id: "u1", resetTokenExpiry: new Date(Date.now() + 60_000) } as never);
    await passwordResetService.resetPassword("t", "longenough");
    expect(userRepository.updatePartial).toHaveBeenCalledWith("u1", expect.anything());
    const patch = vi.mocked(userRepository.updatePartial).mock.calls[0]![1] as { password: string; resetToken: null; resetTokenExpiry: null };
    expect(patch.password).not.toBe("longenough");
    expect(patch.password).toMatch(/^\$2[aby]\$/);
    expect(patch.resetToken).toBeNull();
    expect(patch.resetTokenExpiry).toBeNull();
  });

  it("deletes the user's sessions after the password is saved", async () => {
    vi.mocked(userRepository.findByResetToken).mockResolvedValue({ id: "u1", resetTokenExpiry: new Date(Date.now() + 60_000) } as never);
    await passwordResetService.resetPassword("t", "longenough");
    expect(userSessionRepository.deleteByUserId).toHaveBeenCalledWith("u1");
    const saved = vi.mocked(userRepository.updatePartial).mock.invocationCallOrder[0]!;
    const killed = vi.mocked(userSessionRepository.deleteByUserId).mock.invocationCallOrder[0]!;
    expect(killed).toBeGreaterThan(saved);
  });

  it("leaves sessions alone when the token is rejected", async () => {
    vi.mocked(userRepository.findByResetToken).mockResolvedValue(undefined);
    await passwordResetService.resetPassword("bad", "longenough").catch(() => undefined);
    vi.mocked(userRepository.findByResetToken).mockResolvedValue({ id: "u1", resetTokenExpiry: new Date(Date.now() - 1000) } as never);
    await passwordResetService.resetPassword("old", "longenough").catch(() => undefined);
    expect(userSessionRepository.deleteByUserId).not.toHaveBeenCalled();
  });
});

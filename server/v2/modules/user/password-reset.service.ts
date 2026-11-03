import bcrypt from "bcryptjs";
import crypto from "crypto";
import { AppError } from "../../utils/error-handler";
import { escapeHtml } from "../../utils/escape-html";
import { getPublicBaseUrl } from "../../utils/public-url";
import { isProductionRuntime, resolveLinkBase } from "../../utils/link-base";
import { getEmailProvider, isRealEmailProvider } from "../../../services/email-provider";
import { userRepository } from "./user.repository";
import { userSessionRepository } from "./user-session.repository";
import { MIN_PASSWORD_LENGTH } from "./password-reset.validator";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
export { MIN_PASSWORD_LENGTH };

export function buildResetUrl(token: string, requestOrigin?: string | null): string {
  const base = resolveLinkBase({ configured: getPublicBaseUrl(), requestOrigin, isProduction: isProductionRuntime() });
  return `${base}/reset-password/${encodeURIComponent(token)}`;
}

function buildResetEmail(name: string, url: string) {
  const subject = "Reset your Travana password";
  const text = `Hi ${name},\n\nWe received a request to reset your Travana password. Use the link below to choose a new one:\n${url}\n\nThis link expires in 1 hour. If you did not ask for this, you can ignore this email.`;
  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>We received a request to reset your Travana password. Click the button below to choose a new one:</p>
    <p><a href="${url}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px">Reset password</a></p>
    <p>This link expires in 1 hour. If you did not ask for this, you can ignore this email.</p>
  `;
  return { subject, text, html };
}

/**
 * Sends the reset email. Never throws and never logs the token or link. In
 * production with no real provider (console fallback) nothing is sent: the console
 * provider would print the live reset link into the logs.
 */
async function deliverResetEmail(email: string, name: string, token: string, requestOrigin?: string | null): Promise<void> {
  try {
    const provider = getEmailProvider();
    if (isProductionRuntime() && !isRealEmailProvider(provider)) {
      console.error("[auth] password reset email NOT sent: no real email provider is configured in production");
      return;
    }
    const { subject, html, text } = buildResetEmail(name, buildResetUrl(token, requestOrigin));
    await provider.send({ to: email, subject, html, text });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error";
    console.error(`[auth] password reset email failed: ${reason}`);
  }
}

export const passwordResetService = {
  /**
   * Issues a reset token and emails the link. Silent for unknown emails so the
   * caller can answer identically either way. Delivery runs in the background so
   * response timing does not reveal whether the account exists.
   */
  async requestReset(emailRaw: string, requestOrigin?: string | null): Promise<void> {
    const email = emailRaw.toLowerCase().trim();
    const found = await userRepository.findByEmail(email);
    if (!found) return;

    const token = crypto.randomBytes(32).toString("hex");
    await userRepository.updatePartial(found.id, {
      resetToken: token,
      resetTokenExpiry: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });
    void deliverResetEmail(found.email, found.name, token, requestOrigin);
  },

  /** Sets a new password from a valid token, then clears the token so it cannot be reused. */
  async resetPassword(token: string, password: string): Promise<void> {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new AppError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`, 400);
    }
    const found = await userRepository.findByResetToken(token);
    if (!found) throw new AppError("Invalid or expired reset link", 400);
    if (!found.resetTokenExpiry || new Date(found.resetTokenExpiry) < new Date()) {
      throw new AppError("Reset link has expired", 400);
    }
    await userRepository.updatePartial(found.id, {
      password: await bcrypt.hash(password, 10),
      resetToken: null,
      resetTokenExpiry: null,
    });
    // Whoever held the old password (possibly an attacker) must not stay signed in.
    // Best-effort and logged by the repository; the password change has already committed.
    await userSessionRepository.deleteByUserId(found.id);
  },
};

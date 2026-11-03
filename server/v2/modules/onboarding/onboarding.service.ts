import { planRepository } from "../plan/plan.repository";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { AppError } from "../../utils/error-handler";
import { getPublicBaseUrl } from "../../utils/public-url";
import { escapeHtml } from "../../utils/escape-html";
import { getEmailProvider, isRealEmailProvider } from "../../../services/email-provider";
import { onboardingRepository } from "./onboarding.repository";
import { organizationRepository } from "../organization/organization.repository";
import { userRepository } from "../user/user.repository";
import { sendsevenProvisioningService } from "../conversation-integration/sendseven-provisioning.service";
import { buildDefaultBranchSchedule } from "../branch/branch-defaults";
import { isProductionRuntime, resolveLinkBase } from "../../utils/link-base";
import type { SignupPayload, SignupResult } from "./onboarding.types";

const ORG_ROLE_ADMIN = "org_admin";
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const SLUG_MIN = 3;
const SLUG_MAX = 40;
const SLUG_INSERT_ATTEMPTS = 3;
const SLUG_SUFFIX_ROOM = 7;

/** Lowercase, hyphenated, 3-40 character URL slug from a business name. */
export function slugifyBusinessName(name: string): string {
  let base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base.length < SLUG_MIN) base = base ? `${base}-agency` : "agency";
  return base.slice(0, SLUG_MAX - SLUG_SUFFIX_ROOM).replace(/-+$/g, "");
}

const SLUG_SEQUENTIAL_LOOKUPS = 5;

function randomSlugSuffix(base: string): string {
  return `${base}-${crypto.randomBytes(3).toString("hex")}`;
}

/**
 * First attempt: the bare slug, then -2..-5 (five lookups at most). Later
 * attempts (after losing a race) and exhausted suffixes use a short random suffix.
 */
async function generateUniqueSlug(name: string, randomOnly: boolean): Promise<string> {
  const base = slugifyBusinessName(name);
  if (randomOnly) return randomSlugSuffix(base);
  for (let n = 1; n <= SLUG_SEQUENTIAL_LOOKUPS; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (!(await organizationRepository.findBySlug(candidate))) return candidate;
  }
  return randomSlugSuffix(base);
}

const UNIQUE_VIOLATION = "23505";

/** Constraint name of a Postgres unique violation (23505) anywhere in the error chain, or null. */
function uniqueViolation(err: unknown): { constraint: string } | null {
  let current: unknown = err;
  for (let depth = 0; depth < 4 && typeof current === "object" && current !== null; depth++) {
    const e = current as { code?: unknown; constraint?: unknown; constraint_name?: unknown; cause?: unknown };
    if (e.code === UNIQUE_VIOLATION) {
      const name = typeof e.constraint === "string" ? e.constraint : typeof e.constraint_name === "string" ? e.constraint_name : "";
      return { constraint: name };
    }
    current = e.cause;
  }
  return null;
}

function buildVerificationUrl(token: string, requestOrigin?: string | null): string {
  const configured = getPublicBaseUrl();
  const isProduction = isProductionRuntime();
  if (!configured && isProduction) {
    console.error(
      "[onboarding] No public base URL configured (set BASE_URL / PUBLIC_BASE_URL) — verification links will be broken",
    );
  }
  const base = resolveLinkBase({ configured, requestOrigin, isProduction });
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

function buildVerificationEmail(name: string, url: string) {
  const subject = "Verify your Travana account";
  const safeName = escapeHtml(name);
  const text = `Hi ${name},\n\nWelcome to Travana. Please verify your email by clicking the link below:\n${url}\n\nThis link expires in 24 hours.`;
  const html = `
    <p>Hi ${safeName},</p>
    <p>Welcome to Travana. Please verify your email by clicking the button below:</p>
    <p><a href="${url}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px">Verify Email</a></p>
    <p>This link expires in 24 hours.</p>
  `;
  return { subject, text, html };
}

export const onboardingService = {
  async signup(payload: SignupPayload, requestOrigin?: string | null): Promise<SignupResult> {
    const ownerEmail = payload.email.toLowerCase().trim();
    const firstName = payload.firstName.trim();
    const lastName = payload.lastName.trim();
    const orgName = payload.businessName.trim();

    // The owner takes one seat on the starter plan.
    const starter = await planRepository.findByCode("starter");
    // No starter plan row: an explicit null (unlimited) until a platform admin sets the plan.
    if (!starter) console.warn("[onboarding] starter plan row missing: org seatLimit set to null (unlimited)");
    const seatLimit = starter ? starter.seatLimit : null;

    const existingUser = await userRepository.findByEmail(ownerEmail);
    if (existingUser) {
      throw new AppError("An account with this email already exists", 409);
    }

    const hashedPassword = await bcrypt.hash(payload.password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = new Date(Date.now() + VERIFICATION_TTL_MS);
    const ownerName = `${firstName} ${lastName}`;

    const buildInput = (slug: string): Parameters<typeof onboardingRepository.signupAgency>[0] => ({
        organization: {
          name: orgName,
          slug,
          plan: "starter",
          isActive: true,
          seatLimit,
          brandColor: "#2563eb",
          logoUrl: null,
          homeworkerCommission: null,
          trialEndsAt: new Date(Date.now() + 14 * 86_400_000),
          settings: { onboarding: { status: "pending", version: 1 } },
        },
        branchInput: {
          name: orgName,
          address: "",
          phone: "",
          email: ownerEmail,
          isActive: true,
          branchType: "shop",
          ...buildDefaultBranchSchedule(),
        },
        ownerUser: {
          id: crypto.randomUUID(),
          name: ownerName,
          email: ownerEmail,
          firstName,
          lastName,
          // user.phoneNumber is NOT NULL; the wizard collects the business phone instead.
          phoneNumber: "",
          role: "Agent",
          orgRole: ORG_ROLE_ADMIN,
          password: hashedPassword,
          emailVerified: false,
          verificationToken,
          verificationTokenExpiry,
        },
        ownerBranchMemberRoleAndActive: { orgRole: ORG_ROLE_ADMIN, isActive: true },
    });

    // Slug uniqueness is checked up front, but two signups can still race to the same
    // slug: retry with a fresh random suffix. A clash on the email is a real 409.
    let result;
    for (let attempt = 0; ; attempt++) {
      const slug = await generateUniqueSlug(orgName, attempt > 0);
      try {
        result = await onboardingRepository.signupAgency(buildInput(slug));
        break;
      } catch (err) {
        const violation = uniqueViolation(err);
        if (!violation) throw err;
        if (violation.constraint.includes("email")) {
          throw new AppError("An account with this email already exists", 409);
        }
        if (attempt + 1 >= SLUG_INSERT_ATTEMPTS) {
          throw new AppError("We could not reserve an agency URL — please try again", 409);
        }
      }
    }

    let emailSent = false;
    try {
      const provider = getEmailProvider();
      const url = buildVerificationUrl(verificationToken, requestOrigin);
      const { subject, html, text } = buildVerificationEmail(ownerName, url);
      await provider.send({ to: ownerEmail, subject, html, text });
      emailSent = isRealEmailProvider(provider);
    } catch (err) {
      console.error("[onboarding] verification email failed (signup still succeeded):", err);
    }

    return {
      orgId: result.orgId,
      userId: result.ownerId,
      branchIds: result.branchIds,
      message: "Agency created — check your email to verify your account",
      emailSent,
    };
  },

  async resendVerification(emailRaw: string, requestOrigin?: string | null): Promise<void> {
    const email = emailRaw.toLowerCase().trim();
    const found = await userRepository.findByEmail(email);

    // Don't leak whether the email exists — just no-op for unknown / already-verified.
    if (!found || found.emailVerified) return;

    if (found.verificationTokenExpiry) {
      const lastSentAt = new Date(found.verificationTokenExpiry).getTime() - VERIFICATION_TTL_MS;
      const elapsed = Date.now() - lastSentAt;
      if (elapsed < RESEND_COOLDOWN_MS) {
        const retryIn = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        throw new AppError(`Please wait ${retryIn} seconds before requesting another verification email.`, 429);
      }
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = new Date(Date.now() + VERIFICATION_TTL_MS);

    await userRepository.update(found.id, { verificationToken, verificationTokenExpiry });

    try {
      const provider = getEmailProvider();
      const url = buildVerificationUrl(verificationToken, requestOrigin);
      const { subject, html, text } = buildVerificationEmail(found.name, url);
      await provider.send({ to: email, subject, html, text });
    } catch (err) {
      console.error("[onboarding] resend verification email failed:", err);
    }
  },

  async verifyEmail(token: string): Promise<void> {
    const found = await userRepository.findByVerificationToken(token);
    if (!found) {
      // The token is cleared on use, so we can't tell "already verified" from "never valid".
      throw new AppError(
        "This link has already been used or has expired — try signing in",
        400,
        true,
        "VERIFICATION_LINK_INVALID",
      );
    }
    if (!found.verificationTokenExpiry || new Date(found.verificationTokenExpiry) < new Date()) {
      throw new AppError("Verification link has expired", 400);
    }

    await userRepository.update(found.id, {
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpiry: null,
    });

    // Auto-provision the org's SendSeven workspace once its owner is verified.
    // Fire-and-forget + idempotent — a failure here must never block verification.
    if (found.orgId) {
      sendsevenProvisioningService.provisionForOrgSafe(found.orgId, { companyEmail: found.email });
    }
  },
};

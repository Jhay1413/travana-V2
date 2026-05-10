import bcrypt from "bcryptjs";
import crypto from "crypto";
import { AppError } from "../../utils/error-handler";
import { getEmailProvider } from "../../../services/email-provider";
import { onboardingRepository } from "./onboarding.repository";
import { organizationRepository } from "../organization/organization.repository";
import { userRepository } from "../user/user.repository";
import type { SignupPayload, SignupResult } from "./onboarding.types";

const ORG_ROLE_ADMIN = "org_admin";
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function mapAgentRoleToOrgRole(agentRole: string): string {
  switch (agentRole) {
    case "Admin":
      return "org_admin";
    case "Manager":
      return "branch_manager";
    case "Senior Agent":
    case "Agent":
    default:
      return "agent";
  }
}

function buildVerificationUrl(token: string): string {
  const base = process.env.APP_URL ?? "http://localhost:5000";
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

function buildVerificationEmail(name: string, url: string) {
  const subject = "Verify your TravelHub account";
  const text = `Hi ${name},\n\nWelcome to TravelHub. Please verify your email by clicking the link below:\n${url}\n\nThis link expires in 24 hours.`;
  const html = `
    <p>Hi ${name},</p>
    <p>Welcome to TravelHub. Please verify your email by clicking the button below:</p>
    <p><a href="${url}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px">Verify Email</a></p>
    <p>This link expires in 24 hours.</p>
  `;
  return { subject, text, html };
}

export const onboardingService = {
  async signup(payload: SignupPayload): Promise<SignupResult> {
    const ownerEmail = payload.ownerEmail.toLowerCase().trim();
    const slug = payload.slug.toLowerCase().trim();

    const existingUser = await userRepository.findByEmail(ownerEmail);
    if (existingUser) {
      throw new AppError("An account with this email already exists", 409);
    }

    const existingOrg = await organizationRepository.findBySlug(slug);
    if (existingOrg) {
      throw new AppError("That agency URL is already taken — try another", 409);
    }

    const conflictingAgentEmails: string[] = [];
    for (const agent of payload.agents) {
      const email = agent.email.toLowerCase().trim();
      if (email === ownerEmail) {
        conflictingAgentEmails.push(email);
        continue;
      }
      const hit = await userRepository.findByEmail(email);
      if (hit) conflictingAgentEmails.push(email);
    }
    if (conflictingAgentEmails.length > 0) {
      throw new AppError(
        `These agent emails already exist: ${conflictingAgentEmails.join(", ")}`,
        409,
      );
    }

    const hashedPassword = await bcrypt.hash(payload.password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = new Date(Date.now() + VERIFICATION_TTL_MS);
    const ownerNameParts = payload.ownerName.trim().split(/\s+/);
    const ownerFirstName = ownerNameParts[0];
    const ownerLastName = ownerNameParts.slice(1).join(" ") || "—";

    const result = await onboardingRepository.signupAgency({
      organization: {
        name: payload.agencyName.trim(),
        slug,
        plan: "starter",
        isActive: true,
        seatLimit: 15,
        brandColor: payload.brandColor ?? "#2563eb",
        logoUrl: payload.logoUrl ?? null,
        trialEndsAt: new Date(Date.now() + 14 * 86_400_000),
      } as any,
      branchInputs: payload.branches.map((b) => ({
        name: b.name.trim(),
        address: b.address.trim(),
        phone: b.phone.trim(),
        email: b.email.trim().toLowerCase(),
        openingPattern: b.openingPattern,
        bankHolidaysOpen: b.bankHolidaysOpen,
        openingHours: b.openingHours,
        isActive: true,
      } as any)),
      ownerUser: {
        id: crypto.randomUUID(),
        name: payload.ownerName.trim(),
        email: ownerEmail,
        firstName: ownerFirstName,
        lastName: ownerLastName,
        phoneNumber: payload.ownerPhone.trim(),
        role: "Agent",
        orgRole: ORG_ROLE_ADMIN,
        password: hashedPassword,
        emailVerified: false,
        verificationToken,
        verificationTokenExpiry,
      } as any,
      ownerBranchMemberRoleAndActive: { orgRole: ORG_ROLE_ADMIN, isActive: true },
      agents: payload.agents.map((agent) => {
        const agentNameParts = agent.name.trim().split(/\s+/);
        const orgRole = mapAgentRoleToOrgRole(agent.role);
        return {
          user: {
            id: crypto.randomUUID(),
            name: agent.name.trim(),
            email: agent.email.toLowerCase().trim(),
            firstName: agentNameParts[0],
            lastName: agentNameParts.slice(1).join(" ") || "—",
            phoneNumber: (agent.phone ?? "").trim(),
            role: "Agent",
            orgRole,
            emailVerified: false,
          } as any,
          branchIndex: agent.branchIndex,
          branchMemberRoleAndActive: { orgRole, isActive: agent.active },
        };
      }),
    });

    try {
      const provider = getEmailProvider();
      const url = buildVerificationUrl(verificationToken);
      const { subject, html, text } = buildVerificationEmail(payload.ownerName.trim(), url);
      await provider.send({ to: ownerEmail, subject, html, text });
    } catch (err) {
      console.error("[onboarding] verification email failed (signup still succeeded):", err);
    }

    return {
      orgId: result.orgId,
      userId: result.ownerId,
      branchIds: result.branchIds,
      message: "Agency created — check your email to verify your account",
    };
  },

  async resendVerification(emailRaw: string): Promise<void> {
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

    await userRepository.update(found.id, { verificationToken, verificationTokenExpiry } as any);

    try {
      const provider = getEmailProvider();
      const url = buildVerificationUrl(verificationToken);
      const { subject, html, text } = buildVerificationEmail(found.name, url);
      await provider.send({ to: email, subject, html, text });
    } catch (err) {
      console.error("[onboarding] resend verification email failed:", err);
    }
  },

  async verifyEmail(token: string): Promise<void> {
    const found = await userRepository.findByVerificationToken(token);
    if (!found) {
      throw new AppError("Invalid or expired verification link", 400);
    }
    if (!found.verificationTokenExpiry || new Date(found.verificationTokenExpiry) < new Date()) {
      throw new AppError("Verification link has expired", 400);
    }

    await userRepository.update(found.id, {
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpiry: null,
    } as any);
  },
};

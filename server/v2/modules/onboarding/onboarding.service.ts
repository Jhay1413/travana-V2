import bcrypt from "bcryptjs";
import crypto from "crypto";
import { AppError } from "../../utils/error-handler";
import { getPublicBaseUrl } from "../../utils/public-url";
import { escapeHtml } from "../../utils/escape-html";
import { getEmailProvider, isRealEmailProvider } from "../../../services/email-provider";
import { inviteService, INVITE_TTL_MS } from "../invite/invite.service";
import { onboardingRepository } from "./onboarding.repository";
import { organizationRepository } from "../organization/organization.repository";
import { userRepository } from "../user/user.repository";
import { sendsevenProvisioningService } from "../conversation-integration/sendseven-provisioning.service";
import type { InsertBranch } from "@shared/schema";
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

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 4 && typeof current === "object" && current !== null; depth++) {
    const e = current as { code?: unknown; cause?: unknown };
    if (e.code === UNIQUE_VIOLATION) return true;
    current = e.cause;
  }
  return false;
}

function buildVerificationUrl(token: string): string {
  let base = getPublicBaseUrl();
  if (!base) {
    const isProduction =
      process.env.NODE_ENV === "production" ||
      Boolean(process.env.REPLIT_DEPLOYMENT || process.env.REPLIT_DEPLOYMENT_ID);
    if (isProduction) {
      console.error(
        "[onboarding] No public base URL configured (set BASE_URL / PUBLIC_BASE_URL) — verification links will be broken",
      );
    }
    base = "http://localhost:5000";
  }
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
  async signup(payload: SignupPayload): Promise<SignupResult> {
    const ownerEmail = payload.ownerEmail.toLowerCase().trim();
    const slug = payload.slug.toLowerCase().trim();
    // validate() does not write parsed data back, so schema defaults never apply.
    const agents = payload.agents ?? [];
    const hasHomeworkers = payload.hasHomeworkers ?? false;

    const seenAgentEmails = new Set<string>();
    const duplicateAgentEmails = new Set<string>();
    for (const agent of agents) {
      const email = agent.email.toLowerCase().trim();
      if (seenAgentEmails.has(email)) duplicateAgentEmails.add(email);
      seenAgentEmails.add(email);
    }
    if (duplicateAgentEmails.size > 0) {
      throw new AppError(
        `Each agent needs a unique email. Duplicated: ${Array.from(duplicateAgentEmails).join(", ")}`,
        409,
      );
    }

    const existingUser = await userRepository.findByEmail(ownerEmail);
    if (existingUser) {
      throw new AppError("An account with this email already exists", 409);
    }

    const existingOrg = await organizationRepository.findBySlug(slug);
    if (existingOrg) {
      throw new AppError("That agency URL is already taken — try another", 409);
    }

    const conflictingAgentEmails: string[] = [];
    for (const agent of agents) {
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

    const branchInputs: Array<Omit<InsertBranch, "organizationId">> = payload.branches.map((b) => ({
      name: b.name.trim(),
      address: b.address.trim(),
      phone: b.phone.trim(),
      email: b.email.trim().toLowerCase(),
      openingPattern: b.openingPattern,
      bankHolidaysOpen: b.bankHolidaysOpen,
      openingHours: b.openingHours,
      isActive: true,
      branchType: "shop",
    }));

    // No shared "Homeworkers" branch: each homeworker gets their own branch when
    // invited. hasHomeworkers only enables the org-level default commission.

    const ownerId = crypto.randomUUID();
    const orgName = payload.agencyName.trim();
    const inviteExpiry = new Date(Date.now() + INVITE_TTL_MS);
    const invitedAt = new Date();

    // Agents are created exactly like invited-but-not-accepted users (see
    // inviteService.send): no password, unverified, an invite token, and an
    // inactive branch membership that acceptInvite activates.
    const agentInputs = agents.map((agent) => {
      const agentNameParts = agent.name.trim().split(/\s+/);
      const orgRole = mapAgentRoleToOrgRole(agent.role);
      const address = agent.address?.trim() || null;
      const contact = agent.contactPerson;
      const contactName = contact?.name?.trim() || null;
      const contactPhone = contact?.phone?.trim() || null;
      const keepContact = Boolean(contactName || contactPhone);
      const contactRel = keepContact ? contact?.relationship || null : null;
      const inviteToken = crypto.randomBytes(32).toString("hex");
      const email = agent.email.toLowerCase().trim();
      return {
        inviteToken,
        email,
        input: {
          user: {
            id: crypto.randomUUID(),
            name: agent.name.trim(),
            email,
            firstName: agentNameParts[0],
            lastName: agentNameParts.slice(1).join(" ") || "—",
            phoneNumber: (agent.phone ?? "").trim(),
            role: "Agent",
            orgRole,
            emailVerified: false,
            inviteToken,
            inviteTokenExpiry: inviteExpiry,
            invitedBy: ownerId,
            invitedAt,
            inviteAgencyName: orgName,
          },
          branchIndex: agent.branchIndex,
          branchMemberRoleAndActive: { orgRole, isActive: false },
          profile: {
            address,
            emergencyContactName: keepContact ? contactName : null,
            emergencyContactRelationship: contactRel,
            emergencyContactPhone: keepContact ? contactPhone : null,
          },
        },
      };
    });

    let result;
    try {
      result = await onboardingRepository.signupAgency({
        organization: {
          name: orgName,
          slug,
          plan: "starter",
          isActive: true,
          seatLimit: 15,
          brandColor: payload.brandColor ?? "#2563eb",
          logoUrl: payload.logoUrl ?? null,
          homeworkerCommission: hasHomeworkers ? payload.homeworkerCommission ?? null : null,
          trialEndsAt: new Date(Date.now() + 14 * 86_400_000),
        },
        branchInputs,
        ownerUser: {
          id: ownerId,
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
        },
        ownerBranchMemberRoleAndActive: { orgRole: ORG_ROLE_ADMIN, isActive: true },
        agents: agentInputs.map((a) => a.input),
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError(
          "That agency URL or one of the email addresses is already taken — please check and try again",
          409,
        );
      }
      throw err;
    }

    // Invite agents through the existing invite email path (never throws).
    for (const agent of agentInputs) {
      try {
        await inviteService.sendInviteEmail(agent.email, orgName, agent.inviteToken);
      } catch (err) {
        console.error(`[onboarding] agent invite email failed for ${agent.email} (signup still succeeded):`, err);
      }
    }

    let emailSent = false;
    try {
      const provider = getEmailProvider();
      const url = buildVerificationUrl(verificationToken);
      const { subject, html, text } = buildVerificationEmail(payload.ownerName.trim(), url);
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

    await userRepository.update(found.id, { verificationToken, verificationTokenExpiry });

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

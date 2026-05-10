import { db } from "../../config/database";
import { organization, branches, branchMembers, user } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { AppError } from "../../utils/error-handler";
import { getEmailProvider } from "../../../services/email-provider";
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

    const [existingUser] = await db.select().from(user).where(eq(user.email, ownerEmail)).limit(1);
    if (existingUser) {
      throw new AppError("An account with this email already exists", 409);
    }

    const [existingOrg] = await db.select().from(organization).where(eq(organization.slug, slug)).limit(1);
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
      const [hit] = await db.select().from(user).where(eq(user.email, email)).limit(1);
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

    const result = await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organization)
        .values({
          name: payload.agencyName.trim(),
          slug,
          plan: "starter",
          isActive: true,
          seatLimit: 15,
          brandColor: payload.brandColor ?? "#2563eb",
          logoUrl: payload.logoUrl ?? null,
          trialEndsAt: new Date(Date.now() + 14 * 86_400_000),
        })
        .returning();

      const branchIds: string[] = [];
      for (let i = 0; i < payload.branches.length; i++) {
        const b = payload.branches[i];
        const [branch] = await tx
          .insert(branches)
          .values({
            organizationId: org.id,
            name: b.name.trim(),
            address: b.address.trim(),
            phone: b.phone.trim(),
            email: b.email.trim().toLowerCase(),
            openingPattern: b.openingPattern,
            bankHolidaysOpen: b.bankHolidaysOpen,
            openingHours: b.openingHours,
            isDefault: i === 0,
            isActive: true,
          })
          .returning();
        branchIds.push(branch.id);
      }
      const defaultBranchId = branchIds[0];

      const ownerId = crypto.randomUUID();
      const [ownerUser] = await tx
        .insert(user)
        .values({
          id: ownerId,
          name: payload.ownerName.trim(),
          email: ownerEmail,
          firstName: ownerFirstName,
          lastName: ownerLastName,
          phoneNumber: payload.ownerPhone.trim(),
          role: "Agent",
          orgId: org.id,
          orgRole: ORG_ROLE_ADMIN,
          password: hashedPassword,
          emailVerified: false,
          verificationToken,
          verificationTokenExpiry,
        })
        .returning();

      await tx.insert(branchMembers).values({
        orgId: org.id,
        branchId: defaultBranchId,
        userId: ownerUser.id,
        orgRole: ORG_ROLE_ADMIN,
        isActive: true,
      });

      for (const agent of payload.agents) {
        const agentId = crypto.randomUUID();
        const agentEmail = agent.email.toLowerCase().trim();
        const agentNameParts = agent.name.trim().split(/\s+/);
        const orgRole = mapAgentRoleToOrgRole(agent.role);
        const branchId = branchIds[agent.branchIndex ?? 0] ?? defaultBranchId;

        await tx.insert(user).values({
          id: agentId,
          name: agent.name.trim(),
          email: agentEmail,
          firstName: agentNameParts[0],
          lastName: agentNameParts.slice(1).join(" ") || "—",
          phoneNumber: (agent.phone ?? "").trim(),
          role: "Agent",
          orgId: org.id,
          orgRole,
          emailVerified: false,
        });

        await tx.insert(branchMembers).values({
          orgId: org.id,
          branchId,
          userId: agentId,
          orgRole,
          isActive: agent.active,
        });
      }

      return { orgId: org.id, ownerId: ownerUser.id, branchIds };
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
    const [found] = await db.select().from(user).where(eq(user.email, email)).limit(1);

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

    await db
      .update(user)
      .set({ verificationToken, verificationTokenExpiry, updatedAt: new Date() })
      .where(eq(user.id, found.id));

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
    const [found] = await db.select().from(user).where(eq(user.verificationToken, token)).limit(1);
    if (!found) {
      throw new AppError("Invalid or expired verification link", 400);
    }
    if (!found.verificationTokenExpiry || new Date(found.verificationTokenExpiry) < new Date()) {
      throw new AppError("Verification link has expired", 400);
    }

    await db
      .update(user)
      .set({
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, found.id));
  },
};

import { referralRepository } from "./referral.repository";
import { neonClientRepository } from "../neon-client/neon-client.repository";
import { vipEnrollmentService } from "../../../services/vipEnrollment.service";
import { walletService } from "../wallet/wallet.service";
import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";
import type { NeonClient } from "@shared/schema";

type ScopeOrTrusted = Scope | { orgId: null };

function effectiveOrgId(scope: ScopeOrTrusted): string | null {
  if (scope.orgId === null) return null;
  if ((scope as Scope).orgRole === "platform_admin") return null;
  return (scope as Scope).orgId || null;
}

async function loadScopedReferral(id: string, scope: ScopeOrTrusted) {
  const orgId = effectiveOrgId(scope);
  if (!orgId) {
    const r = await referralRepository.findById(id);
    if (!r) throw new AppError("Referral not found", 404);
    return r;
  }

  const row = await referralRepository.findByIdWithOrg(id);
  if (!row || row.referrerOrgId !== orgId) {
    throw new AppError("Referral not found", 404);
  }
  const r = await referralRepository.findById(id);
  if (!r) throw new AppError("Referral not found", 404);
  return r;
}

async function assertClientInScope(clientId: string, scope: ScopeOrTrusted) {
  const orgId = effectiveOrgId(scope);
  if (!orgId) return;
  const ok = await referralRepository.clientBelongsToOrg(clientId, orgId);
  if (!ok) throw new AppError("Referral not found", 404);
}

const DEFAULT_REFERRAL_RATE = 25;

function calculatePayoutAmount(
  commission: string | null | undefined,
  ratePercent: number = DEFAULT_REFERRAL_RATE,
): string {
  if (!commission) return "0.00";
  const gross = parseFloat(commission);
  if (isNaN(gross)) return "0.00";
  const rate = Number.isFinite(ratePercent) ? ratePercent : DEFAULT_REFERRAL_RATE;
  const afterHays = gross - gross * 0.10; // 10% Hays deduction (stays)
  return (afterHays * (rate / 100)).toFixed(2);
}

function calculatePayoutTriggerDate(travelDate: string): string {
  const date = new Date(travelDate);
  date.setDate(date.getDate() - 56);
  return date.toISOString().split("T")[0];
}

async function autoApproveEligible(referrerClientId?: string) {
  const due = await referralRepository.findDueForAutoApproval(referrerClientId);
  if (due.length === 0) return;

  const affectedReferrerIds = new Set<string>();
  for (const r of due) {
    await referralRepository.updateStatus(r.id, "IN_WALLET");
    if (r.referrerClientId && r.payoutAmount) {
      await walletService.addReferralCredit(r.referrerClientId, r.id, r.payoutAmount);
    }
    if (r.referrerClientId) affectedReferrerIds.add(r.referrerClientId);
  }
  for (const referrerId of Array.from(affectedReferrerIds)) {
    await vipEnrollmentService.recalculateTier(referrerId);
  }
}

export const referralService = {
  async listReferrals(scope: ScopeOrTrusted) {
    await autoApproveEligible();
    return referralRepository.findAll(effectiveOrgId(scope));
  },

  async getReferralById(id: string, scope: ScopeOrTrusted) {
    return loadScopedReferral(id, scope);
  },

  async getReferralsByReferrer(referrerClientId: string, scope: ScopeOrTrusted) {
    await assertClientInScope(referrerClientId, scope);
    await autoApproveEligible(referrerClientId);
    return referralRepository.findByReferrerClientId(referrerClientId);
  },

  async getStatsByReferrer(referrerClientId: string, scope: ScopeOrTrusted) {
    await assertClientInScope(referrerClientId, scope);
    return referralRepository.getStatsByReferrerId(referrerClientId);
  },

  async getVipOverview(referrerClientId: string, scope: ScopeOrTrusted) {
    await assertClientInScope(referrerClientId, scope);
    return referralRepository.getVipOverview(referrerClientId);
  },

  // Internal: called from booking.service / transaction.service when a booking commits.
  // Caller has already validated the client belongs to its scope.
  async createReferral(data: {
    referrerClientId: string;
    referredClientId?: string;
    referredName: string;
    referredEmail?: string;
    referredPhone?: string;
    transactionId?: string;
    travelDate?: string;
    commission?: string;
    commissionRate?: number;
  }) {
    const payoutTriggerDate = data.travelDate
      ? calculatePayoutTriggerDate(data.travelDate)
      : undefined;

    const rate = data.commissionRate ?? DEFAULT_REFERRAL_RATE;
    const payoutAmount = calculatePayoutAmount(data.commission, rate);

    return referralRepository.create({
      referrerClientId: data.referrerClientId,
      referredClientId: data.referredClientId,
      referredName: data.referredName,
      referredEmail: data.referredEmail,
      referredPhone: data.referredPhone,
      transactionId: data.transactionId,
      travelDate: data.travelDate,
      payoutTriggerDate,
      commission: data.commission,
      commissionRate: String(rate),
      payoutAmount,
      referralStatus: "PENDING",
    });
  },

  // Single entry point for "a booking committed — record the referral if the
  // referred client was linked to a referrer BEFORE this booking". Called from the
  // booking/transaction services. Idempotent: one referral per transaction.
  async ensureReferralForBooking(params: {
    client: NeonClient | undefined;
    booking: { travel_date?: string | null; package_commission?: string | null };
    transactionId: string;
  }) {
    const { client, booking, transactionId } = params;
    if (!client?.referredByClientId) return; // no referrer link → no commission
    const existing = await referralRepository.findByTransactionId(transactionId);
    if (existing) return; // already recorded — don't duplicate

    const referrer = await neonClientRepository.findById(client.referredByClientId);
    const rate = referrer?.referralCommissionRate
      ? parseFloat(referrer.referralCommissionRate)
      : DEFAULT_REFERRAL_RATE;

    await referralService.createReferral({
      referrerClientId: client.referredByClientId,
      referredClientId: client.id,
      referredName: `${client.firstName} ${client.surename}`.trim(),
      referredEmail: client.email ?? undefined,
      referredPhone: client.phoneNumber ?? undefined,
      transactionId,
      travelDate: booking.travel_date ?? undefined,
      commission: booking.package_commission ?? undefined,
      commissionRate: rate,
    });
  },

  async updateStatus(
    id: string,
    status: "PENDING" | "IN_WALLET" | "PAID" | "VOIDED",
    scope: ScopeOrTrusted,
  ) {
    const existing = await loadScopedReferral(id, scope);

    if (existing.referralStatus === "PAID") {
      throw new AppError("Cannot change status of a paid referral", 400);
    }

    const updated = await referralRepository.updateStatus(id, status);

    if (status === "IN_WALLET" && existing.referrerClientId && existing.payoutAmount) {
      await walletService.addReferralCredit(existing.referrerClientId, id, existing.payoutAmount);
    }

    if (
      existing.referrerClientId &&
      (status === "IN_WALLET" || status === "PAID" || status === "VOIDED")
    ) {
      await vipEnrollmentService.recalculateTier(existing.referrerClientId);
    }

    return updated;
  },

  async updateReferral(
    id: string,
    data: {
      travelDate?: string;
      commission?: string;
      referredEmail?: string;
      referredPhone?: string;
    },
    scope: ScopeOrTrusted,
  ) {
    await loadScopedReferral(id, scope);

    const payoutTriggerDate = data.travelDate
      ? calculatePayoutTriggerDate(data.travelDate)
      : undefined;

    const payoutAmount =
      data.commission !== undefined
        ? calculatePayoutAmount(data.commission)
        : undefined;

    return referralRepository.update(id, {
      ...(data.travelDate ? { travelDate: data.travelDate } : {}),
      ...(payoutTriggerDate ? { payoutTriggerDate } : {}),
      ...(data.commission ? { commission: data.commission } : {}),
      ...(payoutAmount ? { payoutAmount } : {}),
      ...(data.referredEmail ? { referredEmail: data.referredEmail } : {}),
      ...(data.referredPhone ? { referredPhone: data.referredPhone } : {}),
    });
  },

  async deleteReferral(id: string, scope: ScopeOrTrusted) {
    const existing = await loadScopedReferral(id, scope);

    if (existing.referralStatus === "PAID") {
      throw new AppError("Cannot delete a paid referral", 400);
    }

    if (
      existing.referralStatus === "IN_WALLET" &&
      existing.referrerClientId
    ) {
      await referralRepository.updateStatus(id, "VOIDED");
      await vipEnrollmentService.recalculateTier(existing.referrerClientId);
    }

    await referralRepository.delete(id);
  },

  // Internal: trusted callers from booking.service when a transaction is voided.
  async voidReferralsByTransaction(transactionId: string) {
    const existing = await referralRepository.findByTransactionId(transactionId);
    if (!existing) return;

    if (existing.referralStatus !== "PAID") {
      await referralRepository.voidByTransactionId(transactionId);

      if (existing.referrerClientId) {
        await vipEnrollmentService.recalculateTier(existing.referrerClientId);
      }
    }
  },

  async syncCommissionByTransaction(transactionId: string, newCommission: string) {
    const existing = await referralRepository.findByTransactionId(transactionId);
    if (!existing) return;

    if (existing.referralStatus !== "PENDING") return;

    const newPayoutAmount = calculatePayoutAmount(newCommission);
    await referralRepository.update(existing.id, {
      commission: newCommission,
      payoutAmount: newPayoutAmount,
    });
  },

  async syncTravelDateByTransaction(transactionId: string, newTravelDate: string) {
    const existing = await referralRepository.findByTransactionId(transactionId);
    if (!existing) return;

    if (existing.referralStatus !== "PENDING") return;

    const newPayoutTriggerDate = calculatePayoutTriggerDate(newTravelDate);
    await referralRepository.update(existing.id, {
      travelDate: newTravelDate,
      payoutTriggerDate: newPayoutTriggerDate,
    });
  },
};

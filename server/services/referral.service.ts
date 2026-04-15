import { referralRepository } from "../repositories/referral.repository";
import { vipEnrollmentService } from "./vipEnrollment.service";
import { AppError } from "../utils/error-handler";

/**
 * Commission formula:
 *   referralPayout = (commission × 0.25) − (commission × 0.10)
 *   i.e. 25% referral share, then deduct 10% Hays fee from that share
 */
function calculatePayoutAmount(commission: string | null | undefined): string {
  if (!commission) return "0.00";
  const gross = parseFloat(commission);
  if (isNaN(gross)) return "0.00";
  return ((gross * 0.25) - (gross * 0.10)).toFixed(2);
}

/**
 * Calculates payoutTriggerDate as travelDate minus 56 days (8 weeks).
 */
function calculatePayoutTriggerDate(travelDate: string): string {
  const date = new Date(travelDate);
  date.setDate(date.getDate() - 56);
  return date.toISOString().split("T")[0];
}

export const referralService = {
  async listReferrals() {
    return referralRepository.findAll();
  },

  async getReferralById(id: string) {
    const r = await referralRepository.findById(id);
    if (!r) throw new AppError("Referral not found", 404);
    return r;
  },

  async getReferralsByReferrer(referrerClientId: string) {
    return referralRepository.findByReferrerClientId(referrerClientId);
  },

  async getStatsByReferrer(referrerClientId: string) {
    return referralRepository.getStatsByReferrerId(referrerClientId);
  },

  async getVipOverview(referrerClientId: string) {
    return referralRepository.getVipOverview(referrerClientId);
  },

  async createReferral(data: {
    referrerClientId: string;
    referredClientId?: string;
    referredName: string;
    referredEmail?: string;
    referredPhone?: string;
    transactionId?: string;
    travelDate?: string;
    commission?: string;
  }) {
    const payoutTriggerDate = data.travelDate
      ? calculatePayoutTriggerDate(data.travelDate)
      : undefined;

    const payoutAmount = calculatePayoutAmount(data.commission);

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
      payoutAmount,
      referralStatus: "PENDING",
    });
  },

  async updateStatus(
    id: string,
    status: "PENDING" | "IN_WALLET" | "PAID" | "VOIDED"
  ) {
    const existing = await referralRepository.findById(id);
    if (!existing) throw new AppError("Referral not found", 404);

    if (existing.referralStatus === "PAID") {
      throw new AppError("Cannot change status of a paid referral", 400);
    }

    const updated = await referralRepository.updateStatus(id, status);

    // Recalculate tier whenever status changes to or from a successful state
    if (
      existing.referrerClientId &&
      (status === "IN_WALLET" || status === "PAID" || status === "VOIDED")
    ) {
      await vipEnrollmentService.recalculateTier(existing.referrerClientId);
    }

    return updated;
  },

  /**
   * Client requests payout: handled in referralPayoutService.requestPayouts()
   * Admin approve/reject: handled in referralPayoutService.approvePayout() / rejectPayout()
   */

  async updateReferral(
    id: string,
    data: {
      travelDate?: string;
      commission?: string;
      referredEmail?: string;
      referredPhone?: string;
    }
  ) {
    const existing = await referralRepository.findById(id);
    if (!existing) throw new AppError("Referral not found", 404);

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

  async deleteReferral(id: string) {
    const existing = await referralRepository.findById(id);
    if (!existing) throw new AppError("Referral not found", 404);

    if (existing.referralStatus === "PAID") {
      throw new AppError("Cannot delete a paid referral", 400);
    }

    // Void it first so tier recalculates
    if (
      existing.referralStatus === "IN_WALLET" &&
      existing.referrerClientId
    ) {
      await referralRepository.updateStatus(id, "VOIDED");
      await vipEnrollmentService.recalculateTier(existing.referrerClientId);
    }

    await referralRepository.delete(id);
  },

  async voidReferralsByTransaction(transactionId: string) {
    // Find and void referrals linked to a cancelled transaction
    const existing = await referralRepository.findByTransactionId(transactionId);
    if (!existing) return;

    if (existing.referralStatus !== "PAID") {
      await referralRepository.voidByTransactionId(transactionId);

      if (existing.referrerClientId) {
        await vipEnrollmentService.recalculateTier(existing.referrerClientId);
      }
    }
  },

  /**
   * When booking commission is updated, recalculate the linked referral's
   * commission and payoutAmount — but only if the referral is still PENDING
   * (not yet approved into wallet). IN_WALLET and PAID amounts are locked.
   */
  async syncCommissionByTransaction(transactionId: string, newCommission: string) {
    const existing = await referralRepository.findByTransactionId(transactionId);
    if (!existing) return; // no referral linked to this booking

    if (existing.referralStatus !== "PENDING") return; // locked once approved

    const newPayoutAmount = calculatePayoutAmount(newCommission);
    await referralRepository.update(existing.id, {
      commission: newCommission,
      payoutAmount: newPayoutAmount,
    });
  },
};

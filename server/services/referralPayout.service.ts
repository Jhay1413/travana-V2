import { referralPayoutRepository } from "../repositories/referralPayout.repository";
import { referralRepository } from "../repositories/referral.repository";
import { vipEnrollmentService } from "./vipEnrollment.service";
import { AppError } from "../utils/error-handler";

export const referralPayoutService = {
  async listPayouts() {
    return referralPayoutRepository.findAll();
  },

  async getPayoutById(id: string) {
    const p = await referralPayoutRepository.findById(id);
    if (!p) throw new AppError("Payout request not found", 404);
    return p;
  },

  async getPayoutsByClient(clientId: string) {
    return referralPayoutRepository.findByClientId(clientId);
  },

  /**
   * Client requests payouts for all eligible (PENDING + isDue) referrals.
   * Creates a referral_payout record (status: requested) for each.
   */
  async requestPayouts(referrerClientId: string) {
    const referrals = await referralRepository.findByReferrerClientId(referrerClientId);
    const eligible = referrals.filter(
      (r: any) => r.referralStatus === "PENDING" && r.isDue
    );

    if (eligible.length === 0) {
      throw new AppError(
        "No eligible referrals to request payout for. Referrals must be pending and due (8 weeks before travel).",
        400
      );
    }

    // Skip any referral that already has an active payout request (idempotency guard)
    const deduped = (
      await Promise.all(
        eligible.map(async (r: any) => {
          const existing = await referralPayoutRepository.findByReferralId(r.id);
          return existing && existing.status === "requested" ? null : r;
        })
      )
    ).filter(Boolean);

    const created = await Promise.all(
      deduped.map((r: any) =>
        referralPayoutRepository.create({
          referral_id: r.id,
          client_id: referrerClientId,
          amount: r.payoutAmount ?? "0",
          status: "requested",
        })
      )
    );

    const totalAmount = deduped.reduce(
      (sum: number, r: any) => sum + parseFloat(r.payoutAmount ?? "0"),
      0
    );

    return { count: created.length, totalAmount: totalAmount.toFixed(2) };
  },

  /**
   * Admin approves a payout request → marks referral_payout approved,
   * credits wallet (referral: PENDING → IN_WALLET).
   */
  async approvePayout(id: string, notes?: string) {
    const payout = await referralPayoutRepository.findById(id);
    if (!payout) throw new AppError("Payout request not found", 404);

    if (payout.status !== "requested") {
      throw new AppError("Only requested payouts can be approved", 400);
    }

    const referral = await referralRepository.findById(payout.referral_id);
    if (!referral) throw new AppError("Referral not found", 404);

    if (referral.referralStatus !== "PENDING") {
      throw new AppError("Referral must be PENDING to approve payout", 400);
    }

    // Approve payout record
    const updated = await referralPayoutRepository.markApproved(id, notes);

    // Credit wallet
    await referralRepository.updateStatus(payout.referral_id, "IN_WALLET");

    // Recalculate VIP tier
    if (referral.referrerClientId) {
      await vipEnrollmentService.recalculateTier(referral.referrerClientId);
    }

    return updated;
  },

  /**
   * Admin rejects a payout request → marks referral_payout rejected.
   * Referral stays PENDING so client can re-request later.
   */
  async rejectPayout(id: string, notes?: string) {
    const payout = await referralPayoutRepository.findById(id);
    if (!payout) throw new AppError("Payout request not found", 404);

    if (payout.status !== "requested") {
      throw new AppError("Only requested payouts can be rejected", 400);
    }

    return referralPayoutRepository.markRejected(id, notes);
  },

  async getTotalEarningsByClient(clientId: string): Promise<number> {
    const rows = await referralPayoutRepository.findByClientId(clientId);
    return rows
      .filter((p) => p.status === "approved")
      .reduce((sum, p) => sum + parseFloat(p.amount ?? "0"), 0);
  },
};

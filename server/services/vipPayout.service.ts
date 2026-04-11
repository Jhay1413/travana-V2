import { vipPayoutRepository } from "../repositories/vipPayout.repository";
import { referralRepository } from "../repositories/referral.repository";
import { AppError } from "../utils/error-handler";

export const vipPayoutService = {
  async listPayouts() {
    return vipPayoutRepository.findAll();
  },

  async getPayoutById(id: string) {
    const p = await vipPayoutRepository.findById(id);
    if (!p) throw new AppError("Payout not found", 404);
    return p;
  },

  async getPayoutsByClient(clientId: string) {
    return vipPayoutRepository.findByClientId(clientId);
  },

  async createPayout(data: {
    referralId: string;
    method: "bank_transfer" | "booking_credit";
    notes?: string;
  }) {
    const referral = await referralRepository.findById(data.referralId);
    if (!referral) throw new AppError("Referral not found", 404);

    if (referral.referralStatus === "VOIDED") {
      throw new AppError("Cannot create payout for a voided referral", 400);
    }
    if (referral.referralStatus === "PAID") {
      throw new AppError("Payout already exists for this referral", 400);
    }
    if (!referral.referrerClientId) {
      throw new AppError("Referral has no referrer client linked", 400);
    }
    if (!referral.payoutAmount) {
      throw new AppError("Referral has no payout amount calculated", 400);
    }

    const existingPayouts = await vipPayoutRepository.findByReferralId(data.referralId);
    if (existingPayouts.length > 0) {
      throw new AppError("A payout record already exists for this referral", 400);
    }

    const payout = await vipPayoutRepository.create({
      referralId: data.referralId,
      clientId: referral.referrerClientId,
      amount: referral.payoutAmount,
      method: data.method,
      status: "pending",
      notes: data.notes,
    });

    // Move referral to IN_WALLET when payout is created
    if (referral.referralStatus === "PENDING") {
      await referralRepository.updateStatus(data.referralId, "IN_WALLET");
    }

    return payout;
  },

  async processPayoutById(id: string, notes?: string) {
    const payout = await vipPayoutRepository.findById(id);
    if (!payout) throw new AppError("Payout not found", 404);

    if (payout.status === "processed") {
      throw new AppError("Payout has already been processed", 400);
    }

    const updated = await vipPayoutRepository.markProcessed(id, notes);

    // Mark referral as PAID
    await referralRepository.updateStatus(payout.referralId, "PAID");

    return updated;
  },

  async getTotalEarningsByClient(clientId: string): Promise<number> {
    return vipPayoutRepository.sumPaidByClientId(clientId);
  },
};

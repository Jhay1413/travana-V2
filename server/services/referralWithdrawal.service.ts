import { referralWithdrawalRepository } from "../repositories/referralWithdrawal.repository";
import { referralRepository } from "../repositories/referral.repository";
import { vipEnrollmentService } from "./vipEnrollment.service";
import { AppError } from "../utils/error-handler";

export const referralWithdrawalService = {
  async listWithdrawals() {
    return referralWithdrawalRepository.findAll();
  },

  async getWithdrawalById(id: string) {
    const w = await referralWithdrawalRepository.findById(id);
    if (!w) throw new AppError("Withdrawal not found", 404);
    return w;
  },

  async getWithdrawalsByClient(clientId: string) {
    return referralWithdrawalRepository.findByClientId(clientId);
  },

  /**
   * Client requests a withdrawal of their IN_WALLET balance.
   * Creates a referral_withdrawal record with bank details (if bank transfer).
   */
  async requestWithdrawal(data: {
    referralId: string;
    clientId: string;
    method: "bank_transfer" | "booking_credit";
    // Bank transfer
    account_name?: string;
    account_number?: string;
    sort_code?: string;
    // Booking credit
    booking_id?: string;
  }) {
    const referral = await referralRepository.findById(data.referralId);
    if (!referral) throw new AppError("Referral not found", 404);

    if (referral.referralStatus !== "IN_WALLET") {
      throw new AppError("Referral must be IN_WALLET before a withdrawal can be requested", 400);
    }
    if (!referral.payoutAmount) {
      throw new AppError("Referral has no payout amount", 400);
    }

    // Idempotent: skip if pending withdrawal already exists
    const existing = await referralWithdrawalRepository.findByReferralId(data.referralId);
    if (existing && existing.status === "pending") {
      return existing;
    }

    if (data.method === "bank_transfer") {
      if (!data.account_name || !data.account_number || !data.sort_code) {
        throw new AppError("Account name, account number and sort code are required for bank transfer", 400);
      }
    }

    return referralWithdrawalRepository.create({
      referral_id: data.referralId,
      client_id: data.clientId,
      amount: referral.payoutAmount,
      method: data.method,
      status: "pending",
      account_name: data.account_name,
      account_number: data.account_number,
      sort_code: data.sort_code,
      booking_id: data.booking_id,
    });
  },

  /**
   * Admin processes a withdrawal request.
   * Bank transfer: records transfer reference.
   * Booking credit: links to booking_id.
   * In both cases: referral → PAID.
   */
  async processWithdrawal(
    id: string,
    data: {
      transfer_reference?: string;
      booking_id?: string;
      credit_note?: string;
      notes?: string;
    }
  ) {
    const withdrawal = await referralWithdrawalRepository.findById(id);
    if (!withdrawal) throw new AppError("Withdrawal not found", 404);

    if (withdrawal.status === "processed") {
      throw new AppError("Withdrawal has already been processed", 400);
    }
    if (withdrawal.status === "rejected") {
      throw new AppError("Cannot process a rejected withdrawal", 400);
    }

    if (withdrawal.method === "bank_transfer" && !data.transfer_reference) {
      throw new AppError("Transfer reference is required when confirming a bank transfer", 400);
    }
    if (withdrawal.method === "booking_credit" && !data.booking_id && !data.credit_note) {
      throw new AppError("Booking ID or credit note is required when applying booking credit", 400);
    }

    const updated = await referralWithdrawalRepository.markProcessed(id, data);

    // Mark referral as PAID
    const referral = await referralRepository.findById(withdrawal.referral_id);
    await referralRepository.updateStatus(withdrawal.referral_id, "PAID");

    // Recalculate VIP tier
    if (referral?.referrerClientId) {
      await vipEnrollmentService.recalculateTier(referral.referrerClientId);
    }

    return updated;
  },

  async rejectWithdrawal(id: string, notes?: string) {
    const withdrawal = await referralWithdrawalRepository.findById(id);
    if (!withdrawal) throw new AppError("Withdrawal not found", 404);

    if (withdrawal.status !== "pending") {
      throw new AppError("Only pending withdrawals can be rejected", 400);
    }

    // Return referral to IN_WALLET so client can re-request
    await referralRepository.updateStatus(withdrawal.referral_id, "IN_WALLET");

    return referralWithdrawalRepository.markRejected(id, notes);
  },

  async getTotalPaidByClient(clientId: string): Promise<number> {
    return referralWithdrawalRepository.sumProcessedByClientId(clientId);
  },
};

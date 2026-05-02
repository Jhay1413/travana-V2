import { walletTransactionRepository } from "../repositories/walletTransaction.repository";
import { AppError } from "../utils/error-handler";

export const walletService = {
  async getBalance(clientId: string): Promise<number> {
    return walletTransactionRepository.getBalance(clientId);
  },

  async getTransactions(clientId: string) {
    return walletTransactionRepository.findByClientId(clientId);
  },

  async listAll() {
    return walletTransactionRepository.findAll();
  },

  // Called when a referral moves to IN_WALLET — creates a processed credit immediately.
  async addReferralCredit(clientId: string, referralId: string, amount: string) {
    return walletTransactionRepository.create({
      client_id: clientId,
      type: "credit",
      source: "referral_commission",
      amount,
      referral_id: referralId,
      status: "processed",
    });
  },

  // Admin allocates wallet credit to a booking — creates a pending debit.
  async applyBookingCredit(clientId: string, bookingId: string, amount: number) {
    const balance = await walletTransactionRepository.getBalance(clientId);
    if (amount <= 0) throw new AppError("Amount must be greater than 0", 400);
    if (amount > balance + 0.001) {
      throw new AppError(`Amount exceeds available balance of £${balance.toFixed(2)}`, 400);
    }

    return walletTransactionRepository.create({
      client_id: clientId,
      type: "debit",
      source: "booking_credit",
      amount: amount.toFixed(2),
      booking_id: bookingId,
      status: "pending",
    });
  },

  // Client or admin requests a bank transfer ��� creates a pending debit.
  async requestBankTransfer(
    clientId: string,
    amount: number,
    bankDetails: { account_name: string; account_number: string; sort_code: string }
  ) {
    const balance = await walletTransactionRepository.getBalance(clientId);
    if (amount <= 0) throw new AppError("Amount must be greater than 0", 400);
    if (amount > balance + 0.001) {
      throw new AppError(`Amount exceeds available balance of £${balance.toFixed(2)}`, 400);
    }

    return walletTransactionRepository.create({
      client_id: clientId,
      type: "debit",
      source: "bank_transfer",
      amount: amount.toFixed(2),
      account_name: bankDetails.account_name,
      account_number: bankDetails.account_number,
      sort_code: bankDetails.sort_code,
      status: "pending",
    });
  },

  // Admin confirms a debit was paid/applied.
  async processDebit(id: string, data: { transfer_reference?: string; notes?: string }) {
    const tx = await walletTransactionRepository.findById(id);
    if (!tx) throw new AppError("Wallet transaction not found", 404);
    if (tx.type !== "debit") throw new AppError("Only debit transactions can be processed", 400);
    if (tx.status === "processed") throw new AppError("Already processed", 400);
    if (tx.status === "rejected") throw new AppError("Cannot process a rejected transaction", 400);

    return walletTransactionRepository.update(id, {
      status: "processed",
      transfer_reference: data.transfer_reference,
      notes: data.notes,
      processed_at: new Date(),
    });
  },

  // Admin rejects a debit — balance is automatically restored (rejected debits excluded from balance).
  async rejectDebit(id: string, notes?: string) {
    const tx = await walletTransactionRepository.findById(id);
    if (!tx) throw new AppError("Wallet transaction not found", 404);
    if (tx.type !== "debit") throw new AppError("Only debit transactions can be rejected", 400);
    if (tx.status !== "pending") throw new AppError("Only pending transactions can be rejected", 400);

    return walletTransactionRepository.update(id, { status: "rejected", notes });
  },

  // Adjust the wallet credit on an existing booking — voids the old pending debit and creates a new one.
  // Called when wallet_credit is changed on a booking edit. If newAmount is 0, only voids.
  async adjustBookingCredit(clientId: string, bookingId: string, newAmount: number) {
    const existing = await walletTransactionRepository.findPendingDebitByBookingId(bookingId);
    if (existing) {
      await walletTransactionRepository.update(existing.id, {
        status: "rejected",
        notes: "Voided by booking credit adjustment",
      });
    }
    if (newAmount > 0) {
      await this.applyBookingCredit(clientId, bookingId, newAmount);
    }
  },
};

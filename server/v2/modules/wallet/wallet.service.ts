import { walletTransactionRepository } from "./wallet-transaction.repository";
import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";
import {
  generateWithdrawalInvoiceBuffer,
  uploadWalletDebitInvoice,
} from "../../../services/invoicePdf.service";

type ScopeOrTrusted = Scope | { orgId: null };

function effectiveOrgId(scope: ScopeOrTrusted): string | null {
  if (scope.orgId === null) return null;
  if ((scope as Scope).orgRole === "platform_admin") return null;
  return (scope as Scope).orgId || null;
}

async function assertClientInScope(clientId: string, scope: ScopeOrTrusted) {
  const orgId = effectiveOrgId(scope);
  if (!orgId) return;
  const ok = await walletTransactionRepository.clientBelongsToOrg(clientId, orgId);
  if (!ok) throw new AppError("Wallet not found", 404);
}

async function assertTxInScope(id: string, scope: ScopeOrTrusted) {
  const orgId = effectiveOrgId(scope);
  if (!orgId) {
    const tx = await walletTransactionRepository.findById(id);
    if (!tx) throw new AppError("Wallet transaction not found", 404);
    return tx;
  }

  const row = await walletTransactionRepository.findByIdWithOrg(id);
  if (!row || row.clientOrgId !== orgId) {
    throw new AppError("Wallet transaction not found", 404);
  }
  const tx = await walletTransactionRepository.findById(id);
  if (!tx) throw new AppError("Wallet transaction not found", 404);
  return tx;
}

export const walletService = {
  async getBalance(clientId: string, scope: ScopeOrTrusted): Promise<number> {
    await assertClientInScope(clientId, scope);
    return walletTransactionRepository.getBalance(clientId);
  },

  async getTransactions(clientId: string, scope: ScopeOrTrusted) {
    await assertClientInScope(clientId, scope);
    return walletTransactionRepository.findByClientId(clientId);
  },

  async listAll(scope: ScopeOrTrusted) {
    return walletTransactionRepository.findAll(effectiveOrgId(scope));
  },

  // Internal: called from referral.service when a referral moves to IN_WALLET.
  // Trusted scope — the caller has already validated the client belongs to its org.
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

  async applyBookingCredit(clientId: string, bookingId: string, amount: number, scope: ScopeOrTrusted) {
    await assertClientInScope(clientId, scope);
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

  async requestBankTransfer(
    clientId: string,
    amount: number,
    bankDetails: { account_name: string; account_number: string; sort_code: string },
    scope: ScopeOrTrusted,
  ) {
    await assertClientInScope(clientId, scope);
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

  async processDebit(id: string, data: { transfer_reference?: string; notes?: string }, scope: ScopeOrTrusted) {
    const tx = await assertTxInScope(id, scope);
    if (tx.type !== "debit") throw new AppError("Only debit transactions can be processed", 400);
    if (tx.status === "processed") throw new AppError("Already processed", 400);
    if (tx.status === "rejected") throw new AppError("Cannot process a rejected transaction", 400);

    const updated = await walletTransactionRepository.update(id, {
      status: "processed",
      transfer_reference: data.transfer_reference,
      notes: data.notes,
      processed_at: new Date(),
    });

    try {
      const details = await walletTransactionRepository.findByIdWithDetails(id);
      if (details) {
        const clientName =
          [details.clientFirstName, details.clientSurname].filter(Boolean).join(" ").trim() ||
          "Client";
        const pdfBuffer = await generateWithdrawalInvoiceBuffer({
          withdrawalId: id,
          requestedAt: details.created_at,
          processedAt: updated.processed_at ?? null,
          clientName,
          clientEmail: details.clientEmail ?? null,
          clientPhone: details.clientPhone ?? null,
          amount: details.amount,
          method: details.source,
          accountName: null,
          accountNumber: null,
          sortCode: null,
          transferReference: details.transfer_reference ?? data.transfer_reference ?? null,
          bookingHaysRef: details.bookingHaysRef ?? null,
          bookingSupplierRef: details.bookingSupplierRef ?? null,
          travelDate: details.bookingTravelDate ?? null,
          referredName: null,
          referredEmail: null,
        });
        const s3Key = await uploadWalletDebitInvoice(id, pdfBuffer);
        await walletTransactionRepository.update(id, { invoice_url: s3Key });
        return { ...updated, invoice_url: s3Key };
      }
    } catch (err) {
      console.error("[invoice] Failed to generate wallet debit invoice:", err);
    }

    return updated;
  },

  async getInvoicePresignedUrl(id: string, scope: ScopeOrTrusted): Promise<string | null> {
    const tx = await assertTxInScope(id, scope);
    let invoiceKey = tx.invoice_url;

    if (!invoiceKey && tx.status === "processed" && tx.type === "debit") {
      try {
        const details = await walletTransactionRepository.findByIdWithDetails(id);
        if (details) {
          const clientName =
            [details.clientFirstName, details.clientSurname].filter(Boolean).join(" ").trim() ||
            "Client";
          const pdfBuffer = await generateWithdrawalInvoiceBuffer({
            withdrawalId: id,
            requestedAt: details.created_at,
            processedAt: details.processed_at ?? null,
            clientName,
            clientEmail: details.clientEmail ?? null,
            clientPhone: details.clientPhone ?? null,
            amount: details.amount,
            method: details.source,
            accountName: null,
            accountNumber: null,
            sortCode: null,
            transferReference: details.transfer_reference ?? null,
            bookingHaysRef: details.bookingHaysRef ?? null,
            bookingSupplierRef: details.bookingSupplierRef ?? null,
            travelDate: details.bookingTravelDate ?? null,
            referredName: null,
            referredEmail: null,
          });
          invoiceKey = await uploadWalletDebitInvoice(id, pdfBuffer);
          await walletTransactionRepository.update(id, { invoice_url: invoiceKey });
        }
      } catch (err) {
        console.error("[invoice] Failed to regenerate wallet debit invoice:", err);
      }
    }

    if (!invoiceKey) return null;
    const { getInvoicePresignedUrl } = await import("../../../services/invoicePdf.service");
    return getInvoicePresignedUrl(invoiceKey);
  },

  async rejectDebit(id: string, notes: string | undefined, scope: ScopeOrTrusted) {
    const tx = await assertTxInScope(id, scope);
    if (tx.type !== "debit") throw new AppError("Only debit transactions can be rejected", 400);
    if (tx.status !== "pending") throw new AppError("Only pending transactions can be rejected", 400);

    return walletTransactionRepository.update(id, { status: "rejected", notes });
  },

  // Internal: called from booking.service when wallet credit on a booking changes.
  // Trusted scope — the caller is the v1 booking flow which has its own client check.
  async adjustBookingCredit(clientId: string, bookingId: string, newAmount: number) {
    const existing = await walletTransactionRepository.findPendingDebitByBookingId(bookingId);
    if (existing) {
      await walletTransactionRepository.update(existing.id, {
        status: "rejected",
        notes: "Voided by booking credit adjustment",
      });
    }
    if (newAmount > 0) {
      await this.applyBookingCredit(clientId, bookingId, newAmount, { orgId: null });
    }
  },
};

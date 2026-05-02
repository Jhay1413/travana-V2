import { Request, Response } from "express";
import { referralWithdrawalService } from "../services/referralWithdrawal.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const referralWithdrawalController = {
  listWithdrawals: asyncHandler(async (_req: Request, res: Response) => {
    const raw = await referralWithdrawalService.listWithdrawals();
    const withdrawals = raw.map((w: any) => ({
      id: w.id,
      referral_id: w.referral_id,
      client_id: w.client_id,
      clientName: [w.clientFirstName, w.clientSurname].filter(Boolean).join(" ") || null,
      clientPhone: w.clientPhone || null,
      clientEmail: w.clientEmail || null,
      amount: w.amount,
      method: w.method,
      status: w.status,
      account_name: w.account_name || null,
      account_number: w.account_number || null,
      sort_code: w.sort_code || null,
      transfer_reference: w.transfer_reference || null,
      booking_id: w.booking_id || null,
      bookingRef: w.bookingHaysRef || null,
      bookingSupplierRef: w.bookingSupplierRef || null,
      credit_note: w.credit_note || null,
      notes: w.notes || null,
      invoice_url: w.invoice_url || null,
      requested_at: w.requested_at,
      processed_at: w.processed_at,
      referredName: w.referredName || null,
      referredEmail: w.referredEmail || null,
      travelDate: w.travelDate || null,
      referralStatus: w.referralStatus || null,
    }));
    return successResponse(res, withdrawals, "Withdrawals retrieved successfully");
  }),

  getWithdrawalById: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const withdrawal = await referralWithdrawalService.getWithdrawalById(id);
    return successResponse(res, withdrawal, "Withdrawal retrieved successfully");
  }),

  processWithdrawal: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const withdrawal = await referralWithdrawalService.processWithdrawal(id, req.body);
    return successResponse(res, withdrawal, "Withdrawal processed successfully");
  }),

  rejectWithdrawal: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const withdrawal = await referralWithdrawalService.rejectWithdrawal(id, req.body.notes);
    return successResponse(res, withdrawal, "Withdrawal rejected");
  }),
};

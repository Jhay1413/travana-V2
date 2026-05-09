import { Request, Response } from 'express';
import { referralPayoutService } from './referral-payout.service';
import { successResponse } from '../../utils/response';
import { asyncHandler } from '../../utils/async-handler';

export const referralPayoutController = {
  listPayouts: asyncHandler(async (_req: Request, res: Response) => {
    const raw = await referralPayoutService.listPayouts();
    const payouts = raw.map((p: any) => ({
      id: p.id,
      referral_id: p.referral_id,
      client_id: p.client_id,
      clientName: [p.clientFirstName, p.clientSurname].filter(Boolean).join(' ') || null,
      clientPhone: p.clientPhone || null,
      clientEmail: p.clientEmail || null,
      amount: p.amount,
      status: p.status,
      notes: p.notes,
      requested_at: p.requested_at,
      approved_at: p.approved_at,
      rejected_at: p.rejected_at,
      referredName: p.referredName || null,
      referredEmail: p.referredEmail || null,
      travelDate: p.travelDate || null,
      referralStatus: p.referralStatus || null,
    }));
    return successResponse(res, payouts, 'Payout requests retrieved successfully');
  }),

  getPayoutById: asyncHandler(async (req: Request, res: Response) => {
    const payout = await referralPayoutService.getPayoutById(req.params.id as string);
    return successResponse(res, payout, 'Payout request retrieved successfully');
  }),

  approvePayout: asyncHandler(async (req: Request, res: Response) => {
    const payout = await referralPayoutService.approvePayout(req.params.id as string, req.body.notes);
    return successResponse(res, payout, 'Payout approved — commission credited to client wallet');
  }),

  rejectPayout: asyncHandler(async (req: Request, res: Response) => {
    const payout = await referralPayoutService.rejectPayout(req.params.id as string, req.body.notes);
    return successResponse(res, payout, 'Payout request rejected');
  }),
};

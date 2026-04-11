import { Request, Response } from "express";
import { vipPayoutService } from "../services/vipPayout.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const vipPayoutController = {
  listPayouts: asyncHandler(async (_req: Request, res: Response) => {
    const raw = await vipPayoutService.listPayouts();
    const payouts = raw.map((p: any) => ({
      id: p.id,
      referralId: p.referralId,
      clientId: p.clientId,
      clientName: [p.clientFirstName, p.clientSurname].filter(Boolean).join(" ") || null,
      clientPhone: p.clientPhone || null,
      clientEmail: p.clientEmail || null,
      amount: p.amount,
      method: p.method,
      status: p.status,
      notes: p.notes,
      processedAt: p.processedAt,
      createdAt: p.createdAt,
      referredName: p.referredName || null,
      referredEmail: p.referredEmail || null,
      referredPhone: p.referredPhone || null,
      referralStatus: p.referralStatus || null,
      travelDate: p.travelDate || null,
      transactionId: p.transactionId || null,
    }));
    return successResponse(res, payouts, "Payouts retrieved successfully");
  }),

  getPayoutById: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const payout = await vipPayoutService.getPayoutById(id);
    return successResponse(res, payout, "Payout retrieved successfully");
  }),

  createPayout: asyncHandler(async (req: Request, res: Response) => {
    const payout = await vipPayoutService.createPayout(req.body);
    return successResponse(res, payout, "Payout created successfully", 201);
  }),

  processPayout: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const payout = await vipPayoutService.processPayoutById(id, req.body.notes);
    return successResponse(res, payout, "Payout processed successfully");
  }),
};

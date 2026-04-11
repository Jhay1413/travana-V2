import { Request, Response } from "express";
import { vipPayoutService } from "../services/vipPayout.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const vipPayoutController = {
  listPayouts: asyncHandler(async (_req: Request, res: Response) => {
    const payouts = await vipPayoutService.listPayouts();
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

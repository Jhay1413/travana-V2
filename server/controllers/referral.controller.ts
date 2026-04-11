import { Request, Response } from "express";
import { referralService } from "../services/referral.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const referralController = {
  listReferrals: asyncHandler(async (_req: Request, res: Response) => {
    const referrals = await referralService.listReferrals();
    return successResponse(res, referrals, "Referrals retrieved successfully");
  }),

  getReferralById: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const referral = await referralService.getReferralById(id);
    return successResponse(res, referral, "Referral retrieved successfully");
  }),

  getReferralsByClient: asyncHandler(async (req: Request, res: Response) => {
    const clientId = String(req.params.clientId);
    const referrals = await referralService.getReferralsByReferrer(clientId);
    return successResponse(res, referrals, "Client referrals retrieved successfully");
  }),

  createReferral: asyncHandler(async (req: Request, res: Response) => {
    const referral = await referralService.createReferral(req.body);
    return successResponse(res, referral, "Referral created successfully", 201);
  }),

  updateReferral: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const referral = await referralService.updateReferral(id, req.body);
    return successResponse(res, referral, "Referral updated successfully");
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const referral = await referralService.updateStatus(id, req.body.status);
    return successResponse(res, referral, "Referral status updated successfully");
  }),

  updatePayoutType: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const referral = await referralService.updatePayoutType(id, req.body.payoutType);
    return successResponse(res, referral, "Payout type updated successfully");
  }),

  deleteReferral: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    await referralService.deleteReferral(id);
    res.status(204).send();
  }),
};

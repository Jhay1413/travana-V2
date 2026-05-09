import { Request, Response } from 'express';
import { referralService } from './referral.service';
import { successResponse } from '../../utils/response';
import { asyncHandler } from '../../utils/async-handler';

export const referralController = {
  listReferrals: asyncHandler(async (_req: Request, res: Response) => {
    const referrals = await referralService.listReferrals();
    return successResponse(res, referrals, 'Referrals retrieved successfully');
  }),

  getReferralById: asyncHandler(async (req: Request, res: Response) => {
    const referralRecord = await referralService.getReferralById(req.params.id as string);
    return successResponse(res, referralRecord, 'Referral retrieved successfully');
  }),

  getReferralsByClient: asyncHandler(async (req: Request, res: Response) => {
    const referrals = await referralService.getReferralsByReferrer(req.params.clientId as string);
    return successResponse(res, referrals, 'Client referrals retrieved successfully');
  }),

  getClientStats: asyncHandler(async (req: Request, res: Response) => {
    const stats = await referralService.getStatsByReferrer(req.params.clientId as string);
    return successResponse(res, stats, 'Client referral stats retrieved successfully');
  }),

  getClientVipOverview: asyncHandler(async (req: Request, res: Response) => {
    const overview = await referralService.getVipOverview(req.params.clientId as string);
    return successResponse(res, overview, 'Client VIP overview retrieved successfully');
  }),

  createReferral: asyncHandler(async (req: Request, res: Response) => {
    const referralRecord = await referralService.createReferral(req.body);
    return successResponse(res, referralRecord, 'Referral created successfully', 201);
  }),

  updateReferral: asyncHandler(async (req: Request, res: Response) => {
    const referralRecord = await referralService.updateReferral(req.params.id as string, req.body);
    return successResponse(res, referralRecord, 'Referral updated successfully');
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const referralRecord = await referralService.updateStatus(req.params.id as string, req.body.status);
    return successResponse(res, referralRecord, 'Referral status updated successfully');
  }),

  deleteReferral: asyncHandler(async (req: Request, res: Response) => {
    await referralService.deleteReferral(req.params.id as string);
    res.status(204).send();
  }),
};

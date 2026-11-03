import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';
import { AppError } from '../../utils/error-handler';
import { getUserId } from '../../../utils/get-user-id';
import { getRequestActor } from '../../utils/request-actor';
import { onboardingSetupService } from './onboarding-setup.service';
import { requestOrigin } from "../../utils/link-base";
import type { OnboardingActor } from './onboarding-setup.types';

/** The org always comes from the authenticated scope, never from the body. */
function actorFromRequest(req: Request): OnboardingActor {
  if (!req.orgId) throw new AppError('No organisation context', 403);
  return {
    orgId:    req.orgId,
    userId:   getUserId(req),
    orgRole:  req.orgRole ?? '',
    branchId: req.branchId ?? null,
    requestActor: getRequestActor(req),
  };
}

export const onboardingSetupController = {
  getState: asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await onboardingSetupService.getState(actorFromRequest(req).orgId));
  }),
  saveBusiness: asyncHandler(async (req: Request, res: Response) => {
    const data = await onboardingSetupService.saveBusiness(actorFromRequest(req), req.body);
    successResponse(res, data, 'Business details saved');
  }),
  addShops: asyncHandler(async (req: Request, res: Response) => {
    const data = await onboardingSetupService.addShops(actorFromRequest(req), req.body.shops, requestOrigin(req));
    successResponse(res, data, 'Shops processed');
  }),
  setHomeworkerCommission: asyncHandler(async (req: Request, res: Response) => {
    const data = await onboardingSetupService.setHomeworkerCommission(actorFromRequest(req).orgId, req.body.percent);
    successResponse(res, data, 'Homeworker commission saved');
  }),
  complete: asyncHandler(async (req: Request, res: Response) => {
    const data = await onboardingSetupService.complete(actorFromRequest(req).orgId);
    successResponse(res, data, 'Onboarding complete');
  }),
};

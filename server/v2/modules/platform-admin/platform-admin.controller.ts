import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { platformAdminService } from './platform-admin.service';
import { successResponse } from '../../utils/response';

export const platformAdminController = {
  listOrgs:   asyncHandler(async (_req: Request, res: Response) => {
    const data = await platformAdminService.listOrganizations();
    successResponse(res, data);
  }),
  getOrg:     asyncHandler(async (req: Request, res: Response) => {
    const data = await platformAdminService.getOrganization(req.params.id);
    successResponse(res, data);
  }),
  suspend:    asyncHandler(async (req: Request, res: Response) => {
    await platformAdminService.suspend(req.params.id);
    successResponse(res, null, 'Organization suspended');
  }),
  activate:   asyncHandler(async (req: Request, res: Response) => {
    await platformAdminService.activate(req.params.id);
    successResponse(res, null, 'Organization activated');
  }),
  changePlan: asyncHandler(async (req: Request, res: Response) => {
    await platformAdminService.changePlan(req.params.id, req.body.plan, req.body.seatLimit);
    successResponse(res, null, 'Plan updated');
  }),
  impersonate: asyncHandler(async (req: Request, res: Response) => {
    // Sets shadow session — implementation TBD
    successResponse(res, null, 'Impersonation not yet implemented');
  }),
};

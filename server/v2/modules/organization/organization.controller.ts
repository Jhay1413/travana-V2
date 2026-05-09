import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { organizationService } from './organization.service';
import { successResponse } from '../../utils/response';

export const organizationController = {
  list:    asyncHandler(async (_req: Request, res: Response) => {
    const data = await organizationService.list();
    successResponse(res, data);
  }),
  getById: asyncHandler(async (req: Request, res: Response) => {
    const data = await organizationService.getById(req.params.id);
    successResponse(res, data);
  }),
  create:  asyncHandler(async (req: Request, res: Response) => {
    const data = await organizationService.create(req.body);
    successResponse(res, data, 'Organization created', 201);
  }),
  update:  asyncHandler(async (req: Request, res: Response) => {
    const data = await organizationService.update(req.params.id, req.body);
    successResponse(res, data);
  }),
  remove:  asyncHandler(async (req: Request, res: Response) => {
    await organizationService.remove(req.params.id);
    successResponse(res, null, 'Organization deleted');
  }),
};

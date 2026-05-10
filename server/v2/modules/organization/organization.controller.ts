import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { organizationService } from './organization.service';
import { successResponse } from '../../utils/response';
import { AppError } from '../../utils/error-handler';

function requireOrgId(req: Request): string {
  if (!req.orgId) throw new AppError('No organisation context', 403);
  return req.orgId;
}

export const organizationController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    const data = await organizationService.list();
    successResponse(res, data);
  }),
  getById: asyncHandler(async (req: Request, res: Response) => {
    const data = await organizationService.getById(req.params.id as string);
    successResponse(res, data);
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    const data = await organizationService.create(req.body);
    successResponse(res, data, 'Organization created', 201);
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    const data = await organizationService.update(req.params.id as string, req.body);
    successResponse(res, data);
  }),
  remove: asyncHandler(async (req: Request, res: Response) => {
    await organizationService.remove(req.params.id as string);
    successResponse(res, null, 'Organization deleted');
  }),

  getMine: asyncHandler(async (req: Request, res: Response) => {
    const orgId = requireOrgId(req);
    const data = await organizationService.getById(orgId);
    successResponse(res, data);
  }),
  updateMine: asyncHandler(async (req: Request, res: Response) => {
    const orgId = requireOrgId(req);
    const data = await organizationService.update(orgId, req.body);
    successResponse(res, data, 'Organisation updated');
  }),
};

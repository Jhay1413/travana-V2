import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { branchService } from './branch.service';
import { successResponse } from '../../utils/response';

export const branchController = {
  list:    asyncHandler(async (req: Request, res: Response) => {
    const data = await branchService.list(req.orgId);
    successResponse(res, data);
  }),
  getById: asyncHandler(async (req: Request, res: Response) => {
    const data = await branchService.getById(req.params.id, req.orgId);
    successResponse(res, data);
  }),
  create:  asyncHandler(async (req: Request, res: Response) => {
    const data = await branchService.create(req.body, req.orgId);
    successResponse(res, data, 'Branch created', 201);
  }),
  update:  asyncHandler(async (req: Request, res: Response) => {
    const data = await branchService.update(req.params.id, req.body, req.orgId);
    successResponse(res, data);
  }),
  remove:  asyncHandler(async (req: Request, res: Response) => {
    await branchService.remove(req.params.id, req.orgId);
    successResponse(res, null, 'Branch deleted');
  }),
};

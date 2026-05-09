import { Request, Response } from 'express';
import { cottageSettingsService } from './cottage.service';
import { asyncHandler } from '../../../utils/async-handler';
import { successResponse } from '../../../utils/response';

export const cottageSettingsController = {
  findAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await cottageSettingsService.findAll(req.query);
    return successResponse(res, result, 'Cottages retrieved');
  }),

  findById: asyncHandler(async (req: Request, res: Response) => {
    const row = await cottageSettingsService.findById(req.params.id);
    return successResponse(res, row, 'Cottage retrieved');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const row = await cottageSettingsService.create(req.body);
    return successResponse(res, row, 'Cottage created', 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const row = await cottageSettingsService.update(req.params.id, req.body);
    return successResponse(res, row, 'Cottage updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await cottageSettingsService.remove(req.params.id);
    res.status(204).send();
  }),
};

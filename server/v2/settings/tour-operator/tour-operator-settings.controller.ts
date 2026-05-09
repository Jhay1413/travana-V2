import { Request, Response } from 'express';
import { tourOperatorSettingsService } from './tour-operator.service';
import { asyncHandler } from '../../../utils/async-handler';
import { successResponse } from '../../../utils/response';

export const tourOperatorSettingsController = {
  findAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await tourOperatorSettingsService.findAll(req.query);
    return successResponse(res, result, 'Tour operators retrieved');
  }),

  findById: asyncHandler(async (req: Request, res: Response) => {
    const row = await tourOperatorSettingsService.findById(req.params.id);
    return successResponse(res, row, 'Tour operator retrieved');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const row = await tourOperatorSettingsService.create(req.body);
    return successResponse(res, row, 'Tour operator created', 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const row = await tourOperatorSettingsService.update(req.params.id, req.body);
    return successResponse(res, row, 'Tour operator updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await tourOperatorSettingsService.remove(req.params.id);
    res.status(204).send();
  }),
};

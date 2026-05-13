import { Request, Response } from 'express';
import { tourOperatorSettingsService } from './tour-operator-settings.service';
import { asyncHandler } from '../../../utils/async-handler';
import { successResponse } from '../../../utils/response';
import { getScope } from '../../utils/scope';

export const tourOperatorSettingsController = {
  findAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await tourOperatorSettingsService.findAll(req.query, getScope(req));
    return successResponse(res, result, 'Tour operators retrieved');
  }),

  findById: asyncHandler(async (req: Request, res: Response) => {
    const row = await tourOperatorSettingsService.findById(req.params.id, getScope(req));
    return successResponse(res, row, 'Tour operator retrieved');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const row = await tourOperatorSettingsService.create(req.body, getScope(req));
    return successResponse(res, row, 'Tour operator created', 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const row = await tourOperatorSettingsService.update(req.params.id, req.body, getScope(req));
    return successResponse(res, row, 'Tour operator updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await tourOperatorSettingsService.remove(req.params.id, getScope(req));
    res.status(204).send();
  }),
};

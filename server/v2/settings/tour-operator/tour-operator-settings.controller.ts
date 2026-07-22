import { Request, Response } from 'express';
import { tourOperatorSettingsService } from './tour-operator-settings.service';
import { asyncHandler } from '../../../utils/async-handler';
import { successResponse } from '../../../utils/response';
import { getScope } from '../../utils/scope';
import { AppError } from '../../../utils/error-handler';

export const tourOperatorSettingsController = {
  findAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await tourOperatorSettingsService.findAll(req.query, getScope(req));
    return successResponse(res, result, 'Tour operators retrieved');
  }),

  findById: asyncHandler(async (req: Request, res: Response) => {
    const row = await tourOperatorSettingsService.findById((req.params.id as string), getScope(req));
    return successResponse(res, row, 'Tour operator retrieved');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const row = await tourOperatorSettingsService.create(req.body, getScope(req));
    return successResponse(res, row, 'Tour operator created', 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const row = await tourOperatorSettingsService.update((req.params.id as string), req.body, getScope(req));
    return successResponse(res, row, 'Tour operator updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await tourOperatorSettingsService.remove((req.params.id as string), getScope(req));
    res.status(204).send();
  }),

  uploadLogo: asyncHandler(async (req: Request, res: Response) => {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) throw new AppError('No file provided', 400);
    const row = await tourOperatorSettingsService.uploadLogo((req.params.id as string), file, getScope(req));
    return successResponse(res, row, 'Tour operator logo uploaded');
  }),

  deleteLogo: asyncHandler(async (req: Request, res: Response) => {
    const row = await tourOperatorSettingsService.deleteLogo((req.params.id as string), getScope(req));
    return successResponse(res, row, 'Tour operator logo removed');
  }),
};

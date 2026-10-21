import type { Request, Response } from 'express';
import { AppError } from '../../utils/error-handler';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';
import { getScope } from '../../utils/scope';
import { tourOperatorSettingsService } from './tour-operator-settings.service';
import { catalogueCreateBody, catalogueListQuery, catalogueUpdateBody } from './tour-operator-settings.validator';

// validate() does not write parsed values back, so each handler parses again.

export const tourOperatorSettingsController = {
  findAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await tourOperatorSettingsService.findAll(catalogueListQuery.parse(req.query));
    return successResponse(res, result, 'Tour operators retrieved');
  }),

  findById: asyncHandler(async (req: Request, res: Response) => {
    const row = await tourOperatorSettingsService.findById(String(req.params.id));
    return successResponse(res, row, 'Tour operator retrieved');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const row = await tourOperatorSettingsService.create(catalogueCreateBody.parse(req.body), getScope(req).userId);
    return successResponse(res, row, 'Tour operator created', 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const row = await tourOperatorSettingsService.update(String(req.params.id), catalogueUpdateBody.parse(req.body));
    return successResponse(res, row, 'Tour operator updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await tourOperatorSettingsService.remove(String(req.params.id));
    res.status(204).send();
  }),

  uploadLogo: asyncHandler(async (req: Request, res: Response) => {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) throw new AppError('No file provided', 400);
    const row = await tourOperatorSettingsService.uploadLogo(String(req.params.id), file);
    return successResponse(res, row, 'Tour operator logo uploaded');
  }),

  deleteLogo: asyncHandler(async (req: Request, res: Response) => {
    const row = await tourOperatorSettingsService.deleteLogo(String(req.params.id));
    return successResponse(res, row, 'Tour operator logo removed');
  }),
};

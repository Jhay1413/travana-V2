import { Request, Response } from 'express';
import { cruiseExtraSettingsService } from './cruise-extra.service';
import { asyncHandler } from '../../../utils/async-handler';
import { successResponse } from '../../../utils/response';

export const cruiseExtraSettingsController = {
  findAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await cruiseExtraSettingsService.findAll(req.query);
    return successResponse(res, result, 'Cruise extras retrieved');
  }),

  findById: asyncHandler(async (req: Request, res: Response) => {
    const row = await cruiseExtraSettingsService.findById((req.params.id as string));
    return successResponse(res, row, 'Cruise extra retrieved');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const row = await cruiseExtraSettingsService.create(req.body);
    return successResponse(res, row, 'Cruise extra created', 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const row = await cruiseExtraSettingsService.update((req.params.id as string), req.body);
    return successResponse(res, row, 'Cruise extra updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await cruiseExtraSettingsService.remove((req.params.id as string));
    res.status(204).send();
  }),
};

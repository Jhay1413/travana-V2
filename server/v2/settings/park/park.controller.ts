import { Request, Response } from 'express';
import { parkSettingsService } from './park.service';
import { asyncHandler } from '../../../utils/async-handler';
import { successResponse } from '../../../utils/response';

export const parkSettingsController = {
  findAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await parkSettingsService.findAll(req.query);
    return successResponse(res, result, 'Parks retrieved');
  }),

  findById: asyncHandler(async (req: Request, res: Response) => {
    const row = await parkSettingsService.findById((req.params.id as string));
    return successResponse(res, row, 'Park retrieved');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const row = await parkSettingsService.create(req.body);
    return successResponse(res, row, 'Park created', 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const row = await parkSettingsService.update((req.params.id as string), req.body);
    return successResponse(res, row, 'Park updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await parkSettingsService.remove((req.params.id as string));
    res.status(204).send();
  }),
};

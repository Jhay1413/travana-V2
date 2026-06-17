import { Request, Response } from 'express';
import { accommodationSettingsService } from './accommodation.service';
import { asyncHandler } from '../../../utils/async-handler';
import { successResponse } from '../../../utils/response';

export const accommodationSettingsController = {
  findAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await accommodationSettingsService.findAll(req.query);
    return successResponse(res, result, 'Accommodations retrieved');
  }),

  findById: asyncHandler(async (req: Request, res: Response) => {
    const row = await accommodationSettingsService.findById((req.params.id as string));
    return successResponse(res, row, 'Accommodation retrieved');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const row = await accommodationSettingsService.create(req.body);
    return successResponse(res, row, 'Accommodation created', 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const row = await accommodationSettingsService.update((req.params.id as string), req.body);
    return successResponse(res, row, 'Accommodation updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await accommodationSettingsService.remove((req.params.id as string));
    res.status(204).send();
  }),
};

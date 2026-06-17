import { Request, Response } from 'express';
import { accommodationTypeSettingsService } from './accommodation-type.service';
import { asyncHandler } from '../../../utils/async-handler';
import { successResponse } from '../../../utils/response';

export const accommodationTypeSettingsController = {
  findAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await accommodationTypeSettingsService.findAll(req.query);
    return successResponse(res, result, 'Accommodation types retrieved');
  }),

  findById: asyncHandler(async (req: Request, res: Response) => {
    const row = await accommodationTypeSettingsService.findById((req.params.id as string));
    return successResponse(res, row, 'Accommodation type retrieved');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const row = await accommodationTypeSettingsService.create(req.body);
    return successResponse(res, row, 'Accommodation type created', 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const row = await accommodationTypeSettingsService.update((req.params.id as string), req.body);
    return successResponse(res, row, 'Accommodation type updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await accommodationTypeSettingsService.remove((req.params.id as string));
    res.status(204).send();
  }),
};

import { Request, Response } from 'express';
import { deletionCodeSettingsService } from './deletion-code.service';
import { asyncHandler } from '../../../utils/async-handler';
import { successResponse } from '../../../utils/response';

export const deletionCodeSettingsController = {
  findAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await deletionCodeSettingsService.findAll(req.query);
    return successResponse(res, result, 'Deletion codes retrieved');
  }),

  findById: asyncHandler(async (req: Request, res: Response) => {
    const row = await deletionCodeSettingsService.findById((req.params.id as string));
    return successResponse(res, row, 'Deletion code retrieved');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const row = await deletionCodeSettingsService.create(req.body);
    return successResponse(res, row, 'Deletion code created', 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const row = await deletionCodeSettingsService.update((req.params.id as string), req.body);
    return successResponse(res, row, 'Deletion code updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await deletionCodeSettingsService.remove((req.params.id as string));
    res.status(204).send();
  }),
};

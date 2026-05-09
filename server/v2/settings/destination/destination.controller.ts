import { Request, Response } from 'express';
import { destinationSettingsService } from './destination.service';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';

export const destinationSettingsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await destinationSettingsService.list(req.query);
    return successResponse(res, result, 'Destinations retrieved');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const row = await destinationSettingsService.getById(req.params.id);
    return successResponse(res, row, 'Destination retrieved');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const row = await destinationSettingsService.create(req.body);
    return successResponse(res, row, 'Destination created', 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const row = await destinationSettingsService.update(req.params.id, req.body);
    return successResponse(res, row, 'Destination updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await destinationSettingsService.remove(req.params.id);
    res.status(204).send();
  }),
};

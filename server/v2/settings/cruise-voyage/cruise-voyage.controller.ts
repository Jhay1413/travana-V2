import { Request, Response } from 'express';
import { cruiseVoyageSettingsService } from './cruise-voyage.service';
import { asyncHandler } from '../../../utils/async-handler';
import { successResponse } from '../../../utils/response';

export const cruiseVoyageSettingsController = {
  findAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await cruiseVoyageSettingsService.findAll(req.query);
    return successResponse(res, result, 'Cruise voyages retrieved');
  }),

  findById: asyncHandler(async (req: Request, res: Response) => {
    const row = await cruiseVoyageSettingsService.findById(req.params.id);
    return successResponse(res, row, 'Cruise voyage retrieved');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const row = await cruiseVoyageSettingsService.create(req.body);
    return successResponse(res, row, 'Cruise voyage created', 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const row = await cruiseVoyageSettingsService.update(req.params.id, req.body);
    return successResponse(res, row, 'Cruise voyage updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await cruiseVoyageSettingsService.remove(req.params.id);
    res.status(204).send();
  }),
};

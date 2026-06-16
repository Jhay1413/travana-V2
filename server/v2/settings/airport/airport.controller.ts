import { Request, Response } from 'express';
import { airportSettingsService } from './airport.service';
import { asyncHandler } from '../../../utils/async-handler';
import { successResponse } from '../../../utils/response';

export const airportSettingsController = {
  findAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await airportSettingsService.findAll(req.query);
    return successResponse(res, result, 'Airports retrieved');
  }),

  findById: asyncHandler(async (req: Request, res: Response) => {
    const row = await airportSettingsService.findById(req.params.id);
    return successResponse(res, row, 'Airport retrieved');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const row = await airportSettingsService.create(req.body);
    return successResponse(res, row, 'Airport created', 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const row = await airportSettingsService.update(req.params.id, req.body);
    return successResponse(res, row, 'Airport updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await airportSettingsService.remove(req.params.id);
    res.status(204).send();
  }),
};

import { Request, Response } from 'express';
import { lodgeSettingsService } from './lodge.service';
import { asyncHandler } from '../../../utils/async-handler';
import { successResponse } from '../../../utils/response';

export const lodgeSettingsController = {
  findAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await lodgeSettingsService.findAll(req.query);
    return successResponse(res, result, 'Lodges retrieved');
  }),

  findById: asyncHandler(async (req: Request, res: Response) => {
    const row = await lodgeSettingsService.findById(req.params.id);
    return successResponse(res, row, 'Lodge retrieved');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const row = await lodgeSettingsService.create(req.body);
    return successResponse(res, row, 'Lodge created', 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const row = await lodgeSettingsService.update(req.params.id, req.body);
    return successResponse(res, row, 'Lodge updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await lodgeSettingsService.remove(req.params.id);
    res.status(204).send();
  }),
};

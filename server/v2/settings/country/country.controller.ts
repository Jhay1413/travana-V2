import { Request, Response } from 'express';
import { countrySettingsService } from './country.service';
import { asyncHandler } from '../../../utils/async-handler';
import { successResponse } from '../../../utils/response';

export const countrySettingsController = {
  findAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await countrySettingsService.findAll(req.query);
    return successResponse(res, result, 'Countries retrieved');
  }),

  findById: asyncHandler(async (req: Request, res: Response) => {
    const row = await countrySettingsService.findById(req.params.id);
    return successResponse(res, row, 'Country retrieved');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const row = await countrySettingsService.create(req.body);
    return successResponse(res, row, 'Country created', 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const row = await countrySettingsService.update(req.params.id, req.body);
    return successResponse(res, row, 'Country updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await countrySettingsService.remove(req.params.id);
    res.status(204).send();
  }),
};

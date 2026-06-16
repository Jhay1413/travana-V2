import { Request, Response } from 'express';
import { packageTypeSettingsService } from './package-type.service';
import { asyncHandler } from '../../../utils/async-handler';
import { successResponse } from '../../../utils/response';

export const packageTypeSettingsController = {
  findAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await packageTypeSettingsService.findAll(req.query);
    return successResponse(res, result, 'Package types retrieved');
  }),

  findById: asyncHandler(async (req: Request, res: Response) => {
    const row = await packageTypeSettingsService.findById(req.params.id);
    return successResponse(res, row, 'Package type retrieved');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const row = await packageTypeSettingsService.create(req.body);
    return successResponse(res, row, 'Package type created', 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const row = await packageTypeSettingsService.update(req.params.id, req.body);
    return successResponse(res, row, 'Package type updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await packageTypeSettingsService.remove(req.params.id);
    res.status(204).send();
  }),
};

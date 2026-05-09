import { Request, Response } from 'express';
import { roomTypeSettingsService } from './room-type.service';
import { asyncHandler } from '../../../utils/async-handler';
import { successResponse } from '../../../utils/response';

export const roomTypeSettingsController = {
  findAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await roomTypeSettingsService.findAll(req.query);
    return successResponse(res, result, 'Room types retrieved');
  }),

  findById: asyncHandler(async (req: Request, res: Response) => {
    const row = await roomTypeSettingsService.findById(req.params.id);
    return successResponse(res, row, 'Room type retrieved');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const row = await roomTypeSettingsService.create(req.body);
    return successResponse(res, row, 'Room type created', 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const row = await roomTypeSettingsService.update(req.params.id, req.body);
    return successResponse(res, row, 'Room type updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await roomTypeSettingsService.remove(req.params.id);
    res.status(204).send();
  }),
};

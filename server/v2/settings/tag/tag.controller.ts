import { Request, Response } from 'express';
import { tagSettingsService } from './tag.service';
import { asyncHandler } from '../../../utils/async-handler';
import { successResponse } from '../../../utils/response';

export const tagSettingsController = {
  findAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await tagSettingsService.findAll(req.query);
    return successResponse(res, result, 'Tags retrieved');
  }),

  findById: asyncHandler(async (req: Request, res: Response) => {
    const row = await tagSettingsService.findById((req.params.id as string));
    return successResponse(res, row, 'Tag retrieved');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const row = await tagSettingsService.create(req.body);
    return successResponse(res, row, 'Tag created', 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const row = await tagSettingsService.update((req.params.id as string), req.body);
    return successResponse(res, row, 'Tag updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await tagSettingsService.remove((req.params.id as string));
    res.status(204).send();
  }),
};

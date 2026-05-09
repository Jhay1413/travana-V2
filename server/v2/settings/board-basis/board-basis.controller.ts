import { Request, Response } from 'express';
import { boardBasisSettingsService } from './board-basis.service';
import { asyncHandler } from '../../../utils/async-handler';
import { successResponse } from '../../../utils/response';

export const boardBasisSettingsController = {
  findAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await boardBasisSettingsService.findAll(req.query);
    return successResponse(res, result, 'Board basis list retrieved');
  }),

  findById: asyncHandler(async (req: Request, res: Response) => {
    const row = await boardBasisSettingsService.findById(req.params.id);
    return successResponse(res, row, 'Board basis retrieved');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const row = await boardBasisSettingsService.create(req.body);
    return successResponse(res, row, 'Board basis created', 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const row = await boardBasisSettingsService.update(req.params.id, req.body);
    return successResponse(res, row, 'Board basis updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await boardBasisSettingsService.remove(req.params.id);
    res.status(204).send();
  }),
};

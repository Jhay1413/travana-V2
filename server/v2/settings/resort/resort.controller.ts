import { Request, Response } from 'express';
import { resortSettingsService } from './resort.service';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';

export const resortSettingsController = {
  list: asyncHandler(async (req: Request, res: Response) => successResponse(res, await resortSettingsService.list(req.query), 'Resorts retrieved')),
  getById: asyncHandler(async (req: Request, res: Response) => successResponse(res, await resortSettingsService.getById((req.params.id as string)), 'Resort retrieved')),
  create: asyncHandler(async (req: Request, res: Response) => successResponse(res, await resortSettingsService.create(req.body), 'Resort created', 201)),
  update: asyncHandler(async (req: Request, res: Response) => successResponse(res, await resortSettingsService.update((req.params.id as string), req.body), 'Resort updated')),
  remove: asyncHandler(async (req: Request, res: Response) => { await resortSettingsService.remove((req.params.id as string)); res.status(204).send(); }),
};

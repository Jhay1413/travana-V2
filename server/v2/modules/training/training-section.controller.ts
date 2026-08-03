import { Request, Response } from 'express';
import { trainingSectionService } from './training-section.service';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';
import { getScope } from '../../utils/scope';

export const trainingSectionController = {
  createSection: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const courseId = req.params.id as string;
    const section = await trainingSectionService.createSection(courseId, req.body, scope);
    return successResponse(res, section, 'Section created successfully', 201);
  }),

  updateSection: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    const section = await trainingSectionService.updateSection(id, req.body, scope);
    return successResponse(res, section, 'Section updated successfully');
  }),

  deleteSection: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    await trainingSectionService.deleteSection(id, scope);
    return successResponse(res, null, 'Section deleted successfully');
  }),

  reorderSections: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const courseId = req.params.id as string;
    const sections = await trainingSectionService.reorderSections(courseId, req.body.order, scope);
    return successResponse(res, sections, 'Sections reordered successfully');
  }),
};

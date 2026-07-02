import { Request, Response } from 'express';
import { trainingProgressService } from './training-progress.service';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';
import { getScope } from '../../utils/scope';

export const trainingProgressController = {
  enroll: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const courseId = req.params.id as string;
    const { enrollment, created } = await trainingProgressService.enroll(courseId, scope);
    return successResponse(
      res,
      enrollment,
      created ? 'Enrolled successfully' : 'Already enrolled',
      created ? 201 : 200,
    );
  }),

  updateProgress: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const lessonId = req.params.id as string;
    const progress = await trainingProgressService.updateLessonProgress(lessonId, req.body, scope);
    return successResponse(res, progress, 'Progress updated successfully');
  }),

  getMyStatus: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const courseId = req.params.id as string;
    const status = await trainingProgressService.getMyStatus(courseId, scope);
    return successResponse(res, status, 'Status retrieved successfully');
  }),
};

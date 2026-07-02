import { Request, Response } from 'express';
import { trainingService } from './training.service';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';
import { getScope } from '../../utils/scope';

export const trainingController = {
  // Admin: every course in scope, any status.
  listCoursesAdmin: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const courses = await trainingService.listCourses(scope);
    return successResponse(res, courses, 'Courses retrieved successfully');
  }),

  // Learner: published courses only, visibility-scoped.
  listCourses: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const courses = await trainingService.listPublishedCourses(scope);
    return successResponse(res, courses, 'Courses retrieved successfully');
  }),

  // Single cohesive response: the course plus its ordered lessons (and each
  // graphics lesson's ordered assets) — see Phase 2 §F.
  getCourseById: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    const course = await trainingService.getCourseWithContent(id, scope);
    return successResponse(res, course, 'Course retrieved successfully');
  }),

  createCourse: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const course = await trainingService.createCourse(req.body, scope);
    return successResponse(res, course, 'Course created successfully', 201);
  }),

  updateCourse: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    const course = await trainingService.updateCourse(id, req.body, scope);
    return successResponse(res, course, 'Course updated successfully');
  }),

  publishCourse: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    const course = await trainingService.publishCourse(id, scope);
    return successResponse(res, course, 'Course published successfully');
  }),

  archiveCourse: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    const course = await trainingService.archiveCourse(id, scope);
    return successResponse(res, course, 'Course archived successfully');
  }),
};

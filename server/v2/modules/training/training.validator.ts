import { z } from 'zod';

const courseBody = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable().optional(),
  thumbnailUrl: z.string().min(1).nullable().optional(),
  visibility: z.enum(['global', 'org']),
  // Only settable by platform_admin — but all authors ARE platform_admin in v1.
  orgId: z.string().uuid().nullable().optional(),
  passingScore: z.number().int().min(0).max(100).default(80),
  requireContentBeforeQuiz: z.boolean().default(true),
});

export const createCourseValidator = z.object({
  body: courseBody,
});

export const updateCourseValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid course id') }),
  body: courseBody.partial(),
});

export const courseIdValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid course id') }),
});

export type CreateCourseBody = z.infer<typeof createCourseValidator>['body'];
export type UpdateCourseBody = z.infer<typeof updateCourseValidator>['body'];

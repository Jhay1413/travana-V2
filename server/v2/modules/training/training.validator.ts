import { z } from 'zod';

const courseBody = z.object({
  title: z.string().min(1, 'Title is required'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().nullable().optional(),
  thumbnailUrl: z.string().min(1).nullable().optional(),
  // Optional so org admins can omit it; the service forces 'org' + their own
  // org for them, and requires it for platform_admin.
  visibility: z.enum(['global', 'org']).optional(),
  // Platform admins choose the tenant; an org_admin's value must equal their own org (enforced in service).
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

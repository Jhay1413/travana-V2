import { z } from 'zod';

const lessonBody = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable().optional(),
  type: z.enum(['video', 'graphics']),
  position: z.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
  videoUrl: z.string().min(1).nullable().optional(),
  videoDurationSec: z.number().int().min(0).nullable().optional(),
});

export const createLessonValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid section id') }),
  body: lessonBody,
});

export const updateLessonValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid lesson id') }),
  // sectionId moves the lesson to another section of the same course.
  body: lessonBody.partial().extend({ sectionId: z.string().uuid('Invalid section id').optional() }),
});

export const lessonIdValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid lesson id') }),
});

export const reorderLessonsValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid section id') }),
  body: z.object({
    order: z
      .array(z.object({ id: z.string().uuid(), position: z.number().int().min(0) }))
      .min(1, 'order must contain at least one entry'),
  }),
});

export const addAssetsValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid lesson id') }),
  body: z.object({
    assets: z
      .array(
        z.object({
          assetUrl: z.string().min(1, 'assetUrl is required'),
          caption: z.string().nullable().optional(),
          position: z.number().int().min(0).optional(),
        }),
      )
      .min(1, 'At least one asset is required'),
  }),
});

export const assetIdValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid asset id') }),
});

export type CreateLessonBody = z.infer<typeof createLessonValidator>['body'];
export type UpdateLessonBody = z.infer<typeof updateLessonValidator>['body'];
export type ReorderLessonsBody = z.infer<typeof reorderLessonsValidator>['body'];
export type AddAssetsBody = z.infer<typeof addAssetsValidator>['body'];

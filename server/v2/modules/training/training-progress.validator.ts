import { z } from 'zod';

export const enrollValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid course id') }),
});

export const myStatusValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid course id') }),
});

export const progressUpdateValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid lesson id') }),
  body: z
    .object({
      progressPct: z.number().int().min(0).max(100).optional(),
      completed: z.boolean().optional(),
    })
    .refine((data) => data.progressPct !== undefined || data.completed !== undefined, {
      message: 'progressPct or completed is required',
    }),
});

export type ProgressUpdateBody = z.infer<typeof progressUpdateValidator>['body'];

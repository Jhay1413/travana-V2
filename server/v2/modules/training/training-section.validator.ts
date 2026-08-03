import { z } from 'zod';

const sectionBody = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export const createSectionValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid course id') }),
  body: sectionBody,
});

export const updateSectionValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid section id') }),
  body: sectionBody.partial(),
});

export const sectionIdValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid section id') }),
});

export const reorderSectionsValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid course id') }),
  body: z.object({
    order: z
      .array(z.object({ id: z.string().uuid(), position: z.number().int().min(0) }))
      .min(1, 'order must contain at least one entry'),
  }),
});

export type CreateSectionBody = z.infer<typeof createSectionValidator>['body'];
export type UpdateSectionBody = z.infer<typeof updateSectionValidator>['body'];
export type ReorderSectionsBody = z.infer<typeof reorderSectionsValidator>['body'];

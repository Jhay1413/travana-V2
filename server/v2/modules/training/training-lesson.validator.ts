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

export const reorderAssetsValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid lesson id') }),
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

export const updateAssetValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid asset id') }),
  body: z.object({
    caption: z.string().max(2000, 'Description must be 2000 characters or fewer').nullable(),
  }),
});

/** Multipart `captions` field: array of nullable strings (each ≤2000 after trim), aligned by index with the uploaded files. */
export const uploadCaptionsSchema = z.array(
  z
    .string()
    .refine((s) => s.trim().length <= 2000, 'Each description must be 2000 characters or fewer')
    .nullable(),
);

function parseCaptionsJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Runs after multer so `body.captions` (a JSON string) is available. */
export const uploadAssetsValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid lesson id') }),
  body: z.object({
    captions: z
      .string()
      .optional()
      .superRefine((raw, ctx) => {
        if (raw === undefined) return;
        const parsed = parseCaptionsJson(raw);
        if (parsed === undefined) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'captions is not valid JSON' });
          return;
        }
        const result = uploadCaptionsSchema.safeParse(parsed);
        if (!result.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: result.error.errors[0]?.message ?? 'captions must be an array of strings or null',
          });
        }
      }),
  }),
});

/** Validated `captions` multipart field → typed array (call only after `uploadAssetsValidator`). */
export function parseValidatedCaptions(raw: unknown): (string | null)[] | undefined {
  if (typeof raw !== 'string') return undefined;
  return uploadCaptionsSchema.parse(JSON.parse(raw));
}

export type UpdateAssetBody = z.infer<typeof updateAssetValidator>['body'];
export type CreateLessonBody = z.infer<typeof createLessonValidator>['body'];
export type UpdateLessonBody = z.infer<typeof updateLessonValidator>['body'];
export type ReorderLessonsBody = z.infer<typeof reorderLessonsValidator>['body'];
export type AddAssetsBody = z.infer<typeof addAssetsValidator>['body'];

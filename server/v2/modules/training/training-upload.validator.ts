import { z } from 'zod';

export const presignUploadValidator = z.object({
  body: z.object({
    fileName: z.string().min(1, 'fileName is required'),
    contentType: z.string().min(1, 'contentType is required'),
    kind: z.enum(['video', 'image']),
  }),
});

export type PresignUploadBody = z.infer<typeof presignUploadValidator>['body'];

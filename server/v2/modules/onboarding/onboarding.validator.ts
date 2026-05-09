import { z } from 'zod';

export const signupSchema = z.object({
  body: z.object({
    agencyName: z.string().min(1),
    slug:       z.string().min(3).max(40).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
    brandColor: z.string().optional(),
    logoUrl:    z.string().url().optional(),
    firstName:  z.string().min(1),
    lastName:   z.string().min(1),
    email:      z.string().email(),
    password:   z.string().min(8, 'Password must be at least 8 characters'),
  }),
});

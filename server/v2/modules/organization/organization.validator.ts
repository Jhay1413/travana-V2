import { z } from 'zod';

export const createOrganizationSchema = z.object({
  body: z.object({
    name:        z.string().min(1),
    slug:        z.string().min(3).max(40).regex(/^[a-z0-9-]+$/),
    plan:        z.enum(['starter', 'growth', 'enterprise']).optional(),
    brandColor:  z.string().optional(),
    logoUrl:     z.string().url().optional(),
  }),
});

export const updateOrganizationSchema = z.object({
  body: z.object({
    name:       z.string().min(1).optional(),
    brandColor: z.string().optional(),
    logoUrl:    z.string().url().optional(),
    isActive:   z.boolean().optional(),
    seatLimit:  z.number().int().positive().optional(),
  }),
});

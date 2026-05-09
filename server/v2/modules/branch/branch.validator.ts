import { z } from 'zod';

export const createBranchSchema = z.object({
  body: z.object({
    name:      z.string().min(1),
    code:      z.string().max(10).optional(),
    address:   z.string().optional(),
    phone:     z.string().optional(),
    isDefault: z.boolean().optional(),
  }),
});

export const updateBranchSchema = z.object({
  body: z.object({
    name:    z.string().min(1).optional(),
    code:    z.string().max(10).optional(),
    address: z.string().optional(),
    phone:   z.string().optional(),
  }),
});

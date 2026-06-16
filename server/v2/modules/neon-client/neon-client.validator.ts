import { z } from 'zod';
import { insertClientTableSchema } from '@shared/schema';

const badgeEnum = z
  .enum(['New Client', 'Repeat Client', 'VIP Client', 'Family Member', 'Time Waster', 'Banned'])
  .or(z.null())
  .optional();

export const createNeonClientValidator = z.object({
  body: insertClientTableSchema.extend({ badge: badgeEnum }),
});

export const updateNeonClientValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: insertClientTableSchema.partial().extend({ badge: badgeEnum }),
});

// Drop identity/tenant columns from import rows — these are assigned
// server-side from the caller's scope, never trusted from the payload.
const importClientRowSchema = insertClientTableSchema
  .omit({ id: true, orgId: true, branchId: true, createdBy: true })
  .extend({ badge: badgeEnum });

export const importNeonClientsValidator = z.object({
  body: z.object({
    clients: z.array(importClientRowSchema).min(1, 'At least one client is required'),
  }),
});

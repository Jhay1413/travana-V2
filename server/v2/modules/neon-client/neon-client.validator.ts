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

const importClientRowSchema = insertClientTableSchema.extend({
  id: z.string().uuid(),
  badge: badgeEnum,
});

export const importNeonClientsValidator = z.object({
  body: z.object({
    clients: z.array(importClientRowSchema).min(1, 'At least one client is required'),
  }),
});

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
  .omit({ orgId: true, branchId: true, createdBy: true })
  .extend({ badge: badgeEnum });

export const importNeonClientsValidator = z.object({
  body: z.object({
    clients: z.array(importClientRowSchema).min(1, 'At least one client is required'),
  }),
});

export const mergeNeonClientValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ targetId: z.string().uuid() }),
});

// The duplicate-group key is the last 9 digits of a phone number (see
// PHONE_KEY_LENGTH in the repository) — digits only, never a formatted number.
export const duplicatePhoneGroupValidator = z.object({
  params: z.object({ phoneKey: z.string().regex(/^\d{9}$/, 'Phone key must be 9 digits') }),
});

export const mergeDuplicateGroupValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    sourceIds: z.array(z.string().uuid()).min(1, 'At least one duplicate client is required'),
  }),
});

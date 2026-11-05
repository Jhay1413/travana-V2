import { z } from 'zod';
import { insertClientTableSchema } from '@shared/schema';
import { isValidPhoneNumber, PHONE_ERROR_MESSAGE } from '@shared/phone';

const badgeEnum = z
  .enum(['New Client', 'Repeat Client', 'VIP Client', 'Family Member', 'Time Waster', 'Banned'])
  .or(z.null())
  .optional();

// Columns that are system-managed (portal credentials, merge/split lineage, VIP
// state, lifecycle status). They are stripped from create/update payloads — the
// PIN has its own endpoint (/:id/portal-pin) and the rest are only ever written
// by server workflows.
export const SYSTEM_MANAGED_CLIENT_FIELDS = {
  portalPin: true,
  mustChangePin: true,
  status: true,
  mergedIntoId: true,
  mergedAt: true,
  mergedBy: true,
  deletedAt: true,
  deletedBy: true,
  splitFromClientId: true,
  vipEnrolledAt: true,
  vipTier: true,
} as const;

// Create rule: an 11-digit UK number (shared with the client forms). validate() does not
// write parsed values back, so the services store withNormalizedPhone's form.
export const phoneNumberSchema = z.string().trim().refine(isValidPhoneNumber, PHONE_ERROR_MESSAGE);

// Update: only shape-limited here. The UK rule is applied by the services when the phone
// is new or changed, so a stored legacy number can still be re-sent untouched.
export const phoneNumberUpdateSchema = z.string().trim().max(40);

const editableClientSchema = insertClientTableSchema.omit(SYSTEM_MANAGED_CLIENT_FIELDS);

export const createNeonClientValidator = z.object({
  body: editableClientSchema.extend({ badge: badgeEnum, phoneNumber: phoneNumberSchema }),
});

export const updateNeonClientValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
  // strict(): a payload carrying a system-managed field is rejected with 400
  // rather than silently dropped, so a bad caller finds out.
  // phoneNumber is only rule-checked (by the service) when it differs from the stored number.
  body: editableClientSchema.partial().extend({ badge: badgeEnum, phoneNumber: phoneNumberUpdateSchema.optional() }).strict(),
});

export const portalPinParamsValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const setPortalPinValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits") }),
});

// Drop identity/tenant columns from import rows — these are assigned
// server-side from the caller's scope, never trusted from the payload.
const importClientRowSchema = insertClientTableSchema
  .omit({ orgId: true, branchId: true, createdBy: true })
  .omit(SYSTEM_MANAGED_CLIENT_FIELDS)
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

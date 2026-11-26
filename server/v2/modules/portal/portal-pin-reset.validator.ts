import { z } from 'zod';
import { PORTAL_ORG_SLUG_MAX_LENGTH } from './portal-org-slug';

export const portalPinResetValidator = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Please enter your email address', invalid_type_error: 'Please enter your email address' })
      .trim()
      .min(1, 'Please enter your email address')
      .max(254, 'Please enter a valid email address')
      .email('Please enter a valid email address'),
    // Lenient like the sign-in's remembered agency: a stale or unknown value must never turn the request into a visible failure.
    org: z.string().max(PORTAL_ORG_SLUG_MAX_LENGTH).optional(),
  }),
});

export type PortalPinResetBody = z.infer<typeof portalPinResetValidator>['body'];

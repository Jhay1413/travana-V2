import { z } from 'zod';
import { PORTAL_DECLINE_REASONS, PORTAL_QUOTE_ACTIONS, PORTAL_QUOTE_NOTE_MAX } from '@shared/portal-quotes';

const token = z.string().min(1).max(200);

export const portalQuoteDetailValidator = z.object({
  params: z.object({ token }),
});

/**
 * What the customer did with a quote. Who they are comes from the session, never from here, so there is no
 * name field. The reason must be one of the fixed chips.
 */
export const portalQuoteActionValidator = z.object({
  params: z.object({ token }),
  body: z.object({
    action: z.enum(PORTAL_QUOTE_ACTIONS, { required_error: 'Choose an action', invalid_type_error: 'Choose an action' }),
    note: z.string().max(PORTAL_QUOTE_NOTE_MAX, 'That note is too long').optional(),
    reason: z.enum(PORTAL_DECLINE_REASONS, { invalid_type_error: 'Please choose one of the listed reasons' }).optional(),
    wantsSimilar: z.boolean().optional(),
  }),
});

export type PortalQuoteActionBody = z.infer<typeof portalQuoteActionValidator>['body'];

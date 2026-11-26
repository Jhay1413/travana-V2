import { z } from 'zod';
import type { AuthenticationExtensionsClientOutputs } from '@simplewebauthn/server';
import { PORTAL_ORG_SLUG_MAX_LENGTH, PORTAL_ORG_SLUG_PATTERN } from './portal-org-slug';

// Booleans arrive as the literal query strings "1"/"0" (the portal's existing
// ?recent=1 convention), not JSON booleans.
const flag = z.enum(['0', '1']).optional();

/** Agency slug as it appears in an agency's portal URL (`?org=`). Strict: used where a bad slug is a caller error. */
const orgSlug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(PORTAL_ORG_SLUG_MAX_LENGTH)
  .regex(PORTAL_ORG_SLUG_PATTERN, 'Invalid agency')
  .optional();

/**
 * Lenient slug: any short string passes validation and the service ignores one
 * that is not a real slug. Used for a remembered/optional agency that must never
 * turn a request into a 400 (a stale value changes nothing).
 */
const lenientOrgSlug = z.string().max(PORTAL_ORG_SLUG_MAX_LENGTH).optional();

const required = (message: string, max = 1000) =>
  z.string({ required_error: message, invalid_type_error: message }).trim().min(1, message).max(max, message);

// ── Authentication ──────────────────────────────────────────────────────────

export const portalLoginValidator = z.object({
  body: z.object({
    email: required('Email and PIN are required', 254),
    // Exactly four digits: anything else can never be a valid PIN, so it is not worth a lookup or a lockout key.
    pin: z
      .string({ required_error: 'Email and PIN are required', invalid_type_error: 'Email and PIN are required' })
      .regex(/^\d{4}$/, 'Incorrect email or PIN'),
    org: orgSlug,
    // Remembered agency from the device: bounded by the slug pattern like `org`, but an unknown slug is harmless.
    preferOrg: orgSlug,
  }),
});

export const portalMagicLoginValidator = z.object({
  body: z.object({
    code: required('Code required', 64),
  }),
});

export const portalChangePinValidator = z.object({
  body: z.object({
    newPin: z
      .string({ required_error: 'Valid 4-digit PIN required', invalid_type_error: 'Valid 4-digit PIN required' })
      .regex(/^\d{4}$/, 'Valid 4-digit PIN required'),
  }),
});

// ── WebAuthn ────────────────────────────────────────────────────────────────

const b64url = (message: string, max = 20000) =>
  z.string({ required_error: message, invalid_type_error: message }).min(1, message).max(max, message);

const isObject = (v: unknown): boolean => typeof v === 'object' && v !== null && !Array.isArray(v);
const challengeToken = z
  .string({ required_error: 'Missing credential data', invalid_type_error: 'Missing credential data' })
  .min(1, 'Missing credential data')
  .max(4000, 'Missing credential data');

const registrationResponse = z.object({
  id: b64url('Missing credential data', 1024),
  rawId: b64url('Missing credential data', 1024),
  type: z.literal('public-key'),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  clientExtensionResults: z.custom<AuthenticationExtensionsClientOutputs>(isObject, 'Missing credential data'),
  response: z.object({
    clientDataJSON: b64url('Missing credential data'),
    attestationObject: b64url('Missing credential data'),
    authenticatorData: z.string().max(20000).optional(),
    transports: z.array(z.string().max(50)).max(10).optional(),
    publicKeyAlgorithm: z.number().optional(),
    publicKey: z.string().max(20000).optional(),
  }),
});

const authenticationResponse = z.object({
  id: b64url('Missing credential data', 1024),
  rawId: b64url('Missing credential data', 1024),
  type: z.literal('public-key'),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  clientExtensionResults: z.custom<AuthenticationExtensionsClientOutputs>(isObject, 'Missing credential data'),
  response: z.object({
    clientDataJSON: b64url('Missing credential data'),
    authenticatorData: b64url('Missing credential data'),
    signature: b64url('Missing credential data'),
    userHandle: z.string().max(1024).optional(),
  }),
});

/** Registration step 1 and login step 1 take no input at all (so they cannot be used to probe for accounts). */
export const portalWebauthnOptionsValidator = z.object({
  body: z.object({}).passthrough().optional(),
});

export const portalWebauthnRegisterValidator = z.object({
  body: z
    .object({
      challengeToken,
      response: registrationResponse,
      deviceName: z.string().max(255).optional(),
    })
    .strict('Missing credential data'),
});

/**
 * Strict on purpose: the pre-WebAuthn shape `{ credentialId, clientId }` sent by a
 * cached client has no challenge token or signed response and is rejected.
 */
export const portalWebauthnLoginValidator = z.object({
  body: z
    .object({
      challengeToken,
      response: authenticationResponse,
    })
    .strict('Missing credential data'),
});

export const portalWebauthnCheckValidator = z.object({
  body: z.object({}).passthrough().optional(),
});

/** The id is only ever compared inside the service, so any bounded string passes and the answer never depends on it. */
export const portalWebauthnRemoveValidator = z.object({
  params: z.object({ id: z.string().min(1).max(64) }),
});

// ── Deals ───────────────────────────────────────────────────────────────────

export const listPortalDealsValidator = z.object({
  query: z.object({
    country: z.string().trim().min(1).max(100).optional(),
    tag: z.string().trim().min(1).max(100).optional(),
    recent: flag,
    interests: flag,
    // Required for callers without a portal session; ignored when a valid session exists.
    org: lenientOrgSlug,
  }),
});

export const portalDealFiltersValidator = z.object({
  query: z.object({
    org: lenientOrgSlug,
  }),
});

export const portalForYouValidator = z.object({
  query: z.object({
    recent: flag,
  }),
});

// ── Messages ────────────────────────────────────────────────────────────────

/** The longest chat message a customer can send (the portal's Message sheet and chat box stay under this). */
export const PORTAL_MESSAGE_MAX_LENGTH = 5000;

export const portalSendMessageValidator = z.object({
  body: z.object({
    text: z
      .string({ required_error: 'Message text required', invalid_type_error: 'Message text required' })
      .trim()
      .min(1, 'Message text required')
      .max(PORTAL_MESSAGE_MAX_LENGTH, 'That message is too long. Please keep it under 5,000 characters.'),
  }),
});

const looseText = z.union([z.string().max(500), z.number()]).optional();

export const portalQuoteRequestValidator = z.object({
  body: z.object({
    destination: looseText,
    dates: looseText,
    travellers: looseText,
    notes: looseText,
  }),
});

export const portalInterestValidator = z.object({
  body: z.object({
    dealId: required('Deal required', 100),
  }),
});

// ── Tags ────────────────────────────────────────────────────────────────────

export const portalSetTagsValidator = z.object({
  body: z.object({
    tagIds: z
      .array(z.string().max(100), { required_error: 'At least one tag is required', invalid_type_error: 'At least one tag is required' })
      .min(1, 'At least one tag is required')
      .max(100, 'Too many tags'),
  }),
});

// ── Push ────────────────────────────────────────────────────────────────────

export const portalPushSubscribeValidator = z.object({
  body: z.object({
    subscription: z.object(
      {
        endpoint: required('Invalid subscription', 2048),
        keys: z.object({
          p256dh: required('Invalid subscription', 512),
          auth: required('Invalid subscription', 512),
        }),
      },
      { required_error: 'Invalid subscription', invalid_type_error: 'Invalid subscription' },
    ),
  }),
});

export const portalPushUnsubscribeValidator = z.object({
  body: z.object({
    endpoint: required('Endpoint required', 2048),
  }),
});

// ── Wallet ──────────────────────────────────────────────────────────────────

const bankField = z
  .string({ required_error: 'account_name, account_number and sort_code are required' })
  .min(1, 'account_name, account_number and sort_code are required')
  .max(64, 'account_name, account_number and sort_code are required');

export const portalWithdrawValidator = z.object({
  body: z.object({
    amount: z
      .union([z.string().max(20), z.number()], { required_error: 'amount must be a positive number', invalid_type_error: 'amount must be a positive number' })
      .refine((v) => {
        const n = parseFloat(String(v));
        return Number.isFinite(n) && n > 0;
      }, 'amount must be a positive number'),
    account_name: bankField,
    account_number: bankField,
    sort_code: bankField,
  }),
});

// ── Quote view tracking ─────────────────────────────────────────────────────

export const portalQuoteTokenValidator = z.object({
  params: z.object({
    token: z.string().min(1).max(200),
  }),
});

export type PortalLoginBody = z.infer<typeof portalLoginValidator>['body'];
export type PortalMagicLoginBody = z.infer<typeof portalMagicLoginValidator>['body'];
export type PortalChangePinBody = z.infer<typeof portalChangePinValidator>['body'];
export type PortalWebauthnRegisterBody = z.infer<typeof portalWebauthnRegisterValidator>['body'];
export type PortalWebauthnLoginBody = z.infer<typeof portalWebauthnLoginValidator>['body'];
export type ListPortalDealsQuery = z.infer<typeof listPortalDealsValidator>['query'];
export type PortalDealFiltersQuery = z.infer<typeof portalDealFiltersValidator>['query'];
export type PortalForYouQuery = z.infer<typeof portalForYouValidator>['query'];
export type PortalSendMessageBody = z.infer<typeof portalSendMessageValidator>['body'];
export type PortalQuoteRequestBody = z.infer<typeof portalQuoteRequestValidator>['body'];
export type PortalInterestBody = z.infer<typeof portalInterestValidator>['body'];
export type PortalSetTagsBody = z.infer<typeof portalSetTagsValidator>['body'];
export type PortalPushSubscribeBody = z.infer<typeof portalPushSubscribeValidator>['body'];
export type PortalPushUnsubscribeBody = z.infer<typeof portalPushUnsubscribeValidator>['body'];
export type PortalWithdrawBody = z.infer<typeof portalWithdrawValidator>['body'];

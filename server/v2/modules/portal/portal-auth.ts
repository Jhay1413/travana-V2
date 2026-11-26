import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';

// Portal JWT signing/verification, shared between the portal routes (login,
// auth middleware, the legacy /api/portal router) and other modules that need
// to mint portal sessions — e.g. the SMS module embedding a magic-login token
// in a quote link. This is the ONLY place the portal secret is derived.

export interface PortalJwtSecret {
  secret: string;
  /** True when PORTAL_JWT_SECRET was not set and the database-URL derivation was used. */
  usedFallback: boolean;
}

/**
 * Picks the portal JWT secret. A dedicated `PORTAL_JWT_SECRET` wins; when it is
 * not set we fall back to the historic derivation from the database URL so
 * sessions issued before the variable was configured stay valid.
 */
export function resolvePortalJwtSecret(env: NodeJS.ProcessEnv): PortalJwtSecret {
  const dedicated = env.PORTAL_JWT_SECRET?.trim();
  if (dedicated) return { secret: dedicated, usedFallback: false };

  const dbUrl = env.NEON_DATABASE_URL || env.DATABASE_URL || '';
  const secret = crypto.createHash('sha256').update('portal-jwt-' + dbUrl).digest('hex').slice(0, 64);
  return { secret, usedFallback: true };
}

const resolvedSecret = resolvePortalJwtSecret(process.env);
const JWT_SECRET = resolvedSecret.secret;

if (resolvedSecret.usedFallback) {
  console.warn(
    '[portal-auth] PORTAL_JWT_SECRET is not set — falling back to a secret derived from the database URL. ' +
      'Set PORTAL_JWT_SECRET to a long random value (existing portal sessions will need to sign in again).',
  );
}

/**
 * The default PIN older accounts were seeded with (quote texts used to write it). Nothing writes it any more; it stays so
 * those accounts remain safe: it is refused at PIN sign-in while they must change it, and refused as a new PIN.
 */
export const DEFAULT_PORTAL_PIN = '1234';

/** How many hours a staff-sent sign-in link lasts. The link text quotes this, so keep the two in step by using this constant. */
export const STAFF_LINK_TTL_HOURS = 48;

/** Lifetime of a single-use magic-login code that staff send by text or WhatsApp (48 hours). The customer-requested reset link stays 60 minutes. */
export const MAGIC_LINK_TTL_MS = STAFF_LINK_TTL_HOURS * 60 * 60 * 1000;

/** How a portal session was obtained. Face ID enrolment needs a fresh `pin` one. */
export type PortalAuthMethod = 'pin' | 'magic-link' | 'face-id';

export interface PortalTokenPayload {
  clientId: string;
  email: string;
  /** How this session was obtained. Absent on tokens issued before the claim existed. */
  method?: PortalAuthMethod;
  /** Issued-at (seconds), set by jsonwebtoken. */
  iat?: number;
}

export function signPortalToken(
  payload: PortalTokenPayload,
  expiresIn: SignOptions['expiresIn'] = '30d',
): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyPortalToken(token: string): PortalTokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as PortalTokenPayload & { purpose?: unknown };
    // A short-lived purpose token (WebAuthn challenge) is never a session.
    if (payload.purpose !== undefined) return null;
    return payload;
  } catch {
    return null;
  }
}

export type PortalChallengePurpose = 'webauthn-register' | 'webauthn-login';

export interface PortalChallengePayload {
  purpose: PortalChallengePurpose;
  /** The base64url challenge the authenticator must sign. */
  challenge: string;
  /** Unique id, used for the best-effort single-use record. */
  jti: string;
  /** Set for registration: the signed-in client the challenge was issued to. */
  clientId?: string;
}

/** Lifetime of a WebAuthn challenge token. */
export const PORTAL_CHALLENGE_TTL = '2m';

/** Signs a WebAuthn challenge into a short-lived token carrying a distinct `purpose` claim. */
export function signPortalChallengeToken(payload: PortalChallengePayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: PORTAL_CHALLENGE_TTL });
}

/**
 * Verifies a challenge token for the expected purpose. A session token (no
 * purpose) or a token for the other purpose is rejected, as is an expired one.
 */
export function verifyPortalChallengeToken(
  token: string,
  purpose: PortalChallengePurpose,
): (PortalChallengePayload & { exp: number }) | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as Partial<PortalChallengePayload> & { exp?: number };
    if (payload.purpose !== purpose) return null;
    if (typeof payload.challenge !== 'string' || typeof payload.jti !== 'string' || typeof payload.exp !== 'number') return null;
    return { purpose, challenge: payload.challenge, jti: payload.jti, clientId: payload.clientId, exp: payload.exp };
  } catch {
    return null;
  }
}

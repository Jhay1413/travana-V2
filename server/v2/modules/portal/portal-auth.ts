import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';

// Portal JWT signing/verification, shared between the portal routes (login,
// auth middleware) and other modules that need to mint portal sessions — e.g.
// the SMS module embedding a magic-login token in a quote link.

const JWT_SECRET = (() => {
  const dbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || '';
  return crypto.createHash('sha256').update('portal-jwt-' + dbUrl).digest('hex').slice(0, 64);
})();

/** Default PIN seeded for a brand-new portal client (e.g. via a quote SMS). */
export const DEFAULT_PORTAL_PIN = '1234';

/** Lifetime of a single-use magic-login code carried in an SMS link (7 days). */
export const MAGIC_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface PortalTokenPayload {
  clientId: string;
  email: string;
}

export function signPortalToken(
  payload: PortalTokenPayload,
  expiresIn: SignOptions['expiresIn'] = '30d',
): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyPortalToken(token: string): PortalTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as PortalTokenPayload;
  } catch {
    return null;
  }
}

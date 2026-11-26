import crypto from 'crypto';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { AppError } from '../../utils/error-handler';
import { portalRepository } from './portal.repository';
import {
  signPortalChallengeToken,
  signPortalToken,
  verifyPortalChallengeToken,
  type PortalChallengePurpose,
  type PortalTokenPayload,
} from './portal-auth';
import { consumeChallenge } from './portal-challenge-store';
import type { WebauthnRp } from './portal-webauthn-rp';
import type { BiometricLoginResult, WebauthnCheckResult, WebauthnOptionsResult } from './portal.types';

const RP_NAME = 'Tinas Travel';

/** One answer for every way a Face ID sign-in can fail, so nothing reveals whether a credential or client exists. */
export const BIOMETRIC_LOGIN_FAILED = 'Biometric login failed';
export const REGISTRATION_EXPIRED = 'Face ID set-up expired. Please try again.';
export const REGISTRATION_FAILED = 'Face ID set-up failed. Please try again.';
export const REAUTH_REQUIRED_MESSAGE = 'For your security, please sign in with your PIN again before setting up Face ID.';
export const REAUTH_REQUIRED_CODE = 'REAUTH_REQUIRED';

/** A customer may hold at most this many verified credentials; enrolling another replaces the oldest. */
export const MAX_CREDENTIALS_PER_CLIENT = 5;

/** How recently the PIN must have been entered to enrol a new Face ID. */
export const ENROL_FRESHNESS_MS = 10 * 60 * 1000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function loginFailed(): AppError {
  return new AppError(BIOMETRIC_LOGIN_FAILED, 401);
}

let loggedLookupFailure = false;

/**
 * Face ID enrolment needs a fresh PIN sign-in (or the forced change-PIN step that
 * follows a magic link). Tokens without the claim, or from magic link / Face ID
 * sign-in, or older than ENROL_FRESHNESS_MS, are refused with a code the page can
 * handle quietly.
 */
export function assertFreshPinSession(session: PortalTokenPayload, nowMs: number = Date.now()): void {
  const issuedMs = typeof session.iat === 'number' ? session.iat * 1000 : 0;
  if (session.method !== 'pin' || !issuedMs || nowMs - issuedMs > ENROL_FRESHNESS_MS) {
    throw new AppError(REAUTH_REQUIRED_MESSAGE, 403, true, REAUTH_REQUIRED_CODE);
  }
}

function parseTransports(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : undefined;
  } catch {
    return undefined;
  }
}

/** Verifies a challenge token for a purpose and burns it (single use, per instance). */
function redeemChallenge(token: string, purpose: PortalChallengePurpose) {
  const claims = verifyPortalChallengeToken(token, purpose);
  if (!claims) return null;
  if (!consumeChallenge(claims.jti, claims.exp)) return null;
  return claims;
}

export const portalWebauthnService = {
  // ── Registration (signed-in customer only) ───────────────────────────────

  async registrationOptions(
    session: PortalTokenPayload,
    rp: WebauthnRp,
  ): Promise<WebauthnOptionsResult<PublicKeyCredentialCreationOptionsJSON>> {
    assertFreshPinSession(session);
    const clientId = session.clientId;
    const client = await portalRepository.findClientBasicById(clientId);
    if (!client) throw new AppError('Account not available', 401);

    const existing = await portalRepository.findVerifiedWebauthnForClient(clientId);
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: rp.rpID,
      userName: client.email || clientId,
      userID: new TextEncoder().encode(clientId),
      attestationType: 'none',
      excludeCredentials: existing.map((c) => ({ id: c.credentialId, transports: parseTransports(c.transports) })),
      // Discoverable platform credential (Face ID / Touch ID / Windows Hello) with
      // user verification, so login needs no identifier from the browser.
      authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', userVerification: 'required' },
    });

    const challengeToken = signPortalChallengeToken({
      purpose: 'webauthn-register',
      challenge: options.challenge,
      jti: crypto.randomUUID(),
      clientId,
    });
    return { options, challengeToken };
  },

  async register(
    session: PortalTokenPayload,
    input: { challengeToken: string; response: RegistrationResponseJSON; deviceName?: string },
    rp: WebauthnRp,
  ): Promise<void> {
    assertFreshPinSession(session);
    const clientId = session.clientId;
    const claims = redeemChallenge(input.challengeToken, 'webauthn-register');
    // The challenge must have been issued to this very session.
    if (!claims || claims.clientId !== clientId) throw new AppError(REGISTRATION_EXPIRED, 400);

    let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
    try {
      verification = await verifyRegistrationResponse({
        response: input.response,
        expectedChallenge: claims.challenge,
        expectedOrigin: rp.origin,
        expectedRPID: rp.rpID,
        requireUserVerification: true,
      });
    } catch {
      throw new AppError(REGISTRATION_FAILED, 400);
    }
    if (!verification.verified) throw new AppError(REGISTRATION_FAILED, 400);

    const { credential } = verification.registrationInfo;

    // A credential id that already belongs to a different customer can never be claimed.
    const existing = await portalRepository.findWebauthnByCredentialId(credential.id);
    if (existing && existing.clientId !== clientId) throw new AppError(REGISTRATION_FAILED, 400);

    await portalRepository.replaceWebauthnCredential(MAX_CREDENTIALS_PER_CLIENT, {
      clientId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: credential.transports ?? input.response.response.transports ?? [],
      deviceName: input.deviceName?.trim() || 'Unknown device',
    });
  },

  // ── Login ────────────────────────────────────────────────────────────────

  /**
   * Takes no input and always returns the same shape: no client or credential is
   * looked up, so it cannot be used to find out who has Face ID.
   */
  async loginOptions(rp: WebauthnRp): Promise<WebauthnOptionsResult<PublicKeyCredentialRequestOptionsJSON>> {
    const options = await generateAuthenticationOptions({ rpID: rp.rpID, userVerification: 'required' });
    const challengeToken = signPortalChallengeToken({
      purpose: 'webauthn-login',
      challenge: options.challenge,
      jti: crypto.randomUUID(),
    });
    return { options, challengeToken };
  },

  async login(
    input: { challengeToken: string; response: AuthenticationResponseJSON },
    rp: WebauthnRp,
  ): Promise<BiometricLoginResult> {
    const claims = redeemChallenge(input.challengeToken, 'webauthn-login');
    if (!claims) throw loginFailed();

    let cred: Awaited<ReturnType<typeof portalRepository.findWebauthnByCredentialId>>;
    try {
      cred = await portalRepository.findWebauthnByCredentialId(input.response.id);
    } catch (err) {
      // e.g. the verified_at/transports columns are not in the database yet: answer like any other failure.
      if (!loggedLookupFailure) {
        loggedLookupFailure = true;
        console.error('[portal-webauthn] credential lookup failed; Face ID sign-in answers the generic 401:', err);
      }
      throw loginFailed();
    }
    // Unknown credential, or a legacy one that never had a verifiable key.
    if (!cred || !cred.verifiedAt) throw loginFailed();

    let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
    try {
      verification = await verifyAuthenticationResponse({
        response: input.response,
        expectedChallenge: claims.challenge,
        expectedOrigin: rp.origin,
        expectedRPID: rp.rpID,
        credential: {
          id: cred.credentialId,
          publicKey: new Uint8Array(Buffer.from(cred.publicKey, 'base64url')),
          counter: cred.counter,
          transports: parseTransports(cred.transports),
        },
        requireUserVerification: true,
      });
    } catch {
      throw loginFailed();
    }
    if (!verification.verified) throw loginFailed();

    // A counter that does not move forward means a cloned or replayed authenticator.
    // Authenticators that never count report 0 every time, which is allowed.
    const { newCounter } = verification.authenticationInfo;
    if ((newCounter !== 0 || cred.counter !== 0) && newCounter <= cred.counter) throw loginFailed();

    // A soft-deleted client cannot sign in, exactly as with a PIN.
    const client = await portalRepository.findClientBasicById(cred.clientId);
    if (!client) throw loginFailed();

    await portalRepository.updateWebauthnCounter(cred.id, newCounter);

    // Same session as PIN login. The default-PIN block is about typing the seeded
    // default on the PIN form, so it does not apply here; mustChangePin is returned
    // and the portal's PIN gate still forces a new PIN, as it did before.
    const token = signPortalToken({ clientId: client.id, email: client.email || '', method: 'face-id' });
    return { token, clientId: client.id, firstName: client.firstName, mustChangePin: client.mustChangePin };
  },

  // ── Manage set-up devices (signed-in customer only) ──────────────────────

  /** The customer's own Face ID set-ups: id, the device's public credential id and the date it was set up. */
  async listCredentials(clientId: string): Promise<Array<{ id: string; credentialId: string; createdAt: string | null }>> {
    const rows = await portalRepository.findWebauthnCredentialsForClient(clientId);
    return rows.map((r) => ({ id: r.id, credentialId: r.credentialId, createdAt: r.createdAt ? r.createdAt.toISOString() : null }));
  },

  /**
   * Removes one of the signed-in customer's own credentials. Anyone else's, a made-up id and a
   * malformed id all get the same quiet success, so this cannot be used to probe for credentials.
   */
  async removeCredential(clientId: string, id: string): Promise<void> {
    if (!UUID_PATTERN.test(id)) return;
    await portalRepository.deleteWebauthnCredentialForClient(clientId, id);
  },

  // ── Status (signed-in customer only) ─────────────────────────────────────

  async check(clientId: string): Promise<WebauthnCheckResult> {
    try {
      const devices = await portalRepository.findWebauthnDevicesForClient(clientId);
      return { hasBiometric: devices.length > 0, devices };
    } catch {
      return { hasBiometric: false };
    }
  },
};

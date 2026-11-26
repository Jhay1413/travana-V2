import bcrypt from 'bcryptjs';
import { AppError } from '../../utils/error-handler';
import { neonClientRepository } from '../neon-client/neon-client.repository';
import { portalRepository } from './portal.repository';
import { portalLoginTokenRepository } from './portal-login-token.repository';
import { signPortalToken, verifyPortalToken, DEFAULT_PORTAL_PIN, type PortalTokenPayload } from './portal-auth';
import type { LoginCandidate, LoginInput, LoginResult, MagicLoginResult } from './portal.types';
import { normalizeOrgSlug } from './portal-org-slug';
import { InMemoryPinLockout, pinDailyKey, pinLockoutKey, type PinLockout } from './portal-pin-lockout';

/** One message for "no such email", "no PIN set up" and "wrong PIN" so the login form never reveals whether an email exists. */
export const INVALID_CREDENTIALS_MESSAGE = 'Incorrect email or PIN';

export const PIN_LOCKED_MESSAGE =
  'Too many incorrect PIN attempts. PIN sign-in is paused for 15 minutes — use the sign-in link we sent you, or ask your agent to send you a new one.';

export const PIN_DAILY_BUDGET_MESSAGE =
  'PIN sign-in is paused until tomorrow for this email — use the sign-in link we sent you, or ask your agent to send a new one.';

/** One lock store for the process; swap for a database-backed PinLockout later. Exported so tests can clear it. */
export const portalPinLockout = new InMemoryPinLockout();
const pinLockout: PinLockout = portalPinLockout;

// Compared against when no real hash exists so a miss costs the same as a hit.
const TIMING_DUMMY_HASH = bcrypt.hashSync('timing-dummy-pin', 10);

function pinLocked(): AppError {
  return new AppError(
    PIN_LOCKED_MESSAGE,
    429,
  );
}

let loggedBiometricLookupFailure = false;

/**
 * Whether Face ID is set up. A failure here (e.g. the webauthn_credentials columns
 * not pushed yet) must never block a PIN sign-in: log once, report false.
 */
async function checkBiometric(clientId: string): Promise<{ hasBiometric: boolean; biometricCheckFailed: boolean }> {
  try {
    const creds = await portalRepository.findWebauthnCredentialIdsForClient(clientId);
    return { hasBiometric: creds.length > 0, biometricCheckFailed: false };
  } catch (err) {
    if (!loggedBiometricLookupFailure) {
      loggedBiometricLookupFailure = true;
      console.error('[portal-auth] Face ID lookup failed during PIN login; sign-in continues without it:', err);
    }
    // Explicit flag: the page must not offer set-up when we could not look.
    return { hasBiometric: false, biometricCheckFailed: true };
  }
}

/**
 * How many PIN comparisons every sign-in attempt costs, whatever the email
 * matches: real candidates first, padded with dummy compares. Also the cap on
 * candidates fetched. 3 means one email in up to 3 agencies is fully supported
 * while a miss costs about 3 bcrypt hashes (~200ms) rather than 1.
 */
export const LOGIN_COMPARE_COUNT = 3;

/** Spends `count` dummy bcrypt compares so a miss costs the same as a hit. */
async function burnCompares(pin: string, count: number): Promise<void> {
  for (let i = 0; i < count; i++) await bcrypt.compare(pin, TIMING_DUMMY_HASH);
}

function invalidCredentials(): AppError {
  return new AppError(INVALID_CREDENTIALS_MESSAGE, 401);
}

export const portalAuthService = {
  /**
   * Validates a portal bearer token and that the client is still live. A
   * soft-deleted client's existing sessions stop working immediately.
   */
  async verifySession(authorizationHeader: string | undefined): Promise<PortalTokenPayload> {
    if (!authorizationHeader?.startsWith('Bearer ')) throw new AppError('Unauthorized', 401);
    const payload = verifyPortalToken(authorizationHeader.slice(7));
    if (!payload) throw new AppError('Invalid token', 401);

    let active: boolean;
    try {
      active = await portalRepository.isClientActive(payload.clientId);
    } catch (err) {
      console.error('Portal auth check error:', err);
      throw new AppError('Authentication failed', 500);
    }
    if (!active) throw new AppError('Account not available', 401);
    return payload;
  },

  /**
   * Email + PIN sign-in.
   *  - `orgSlug` filters: only that agency's clients are candidates. Without it every
   *    non-deleted client with the email is. Candidates arrive best-first (has a PIN,
   *    oldest, id), so a PIN-less duplicate never shadows the real record.
   *  - `preferOrgSlug` never filters: among candidates whose PIN matches, the one in
   *    that agency wins; otherwise the order above decides. A stale/unknown value
   *    changes nothing.
   *  - Every failure to authenticate (unknown email, no PIN, wrong PIN, default PIN
   *    typed) returns the same 401, and counts toward the per-account lockout.
   */
  async login(input: LoginInput): Promise<LoginResult> {
    const { pin } = input;

    // Keyed on what was typed, so a locked key looks the same for real and made-up emails.
    const email = input.email.trim().slice(0, 254);
    const lockKey = pinLockoutKey(email, input.orgSlug);
    const dailyKey = pinDailyKey(email);
    // Both checks run before any lookup or bcrypt work, and look identical for real and made-up emails.
    if (pinLockout.dailyBlockedForMs(dailyKey) > 0) throw new AppError(PIN_DAILY_BUDGET_MESSAGE, 429);
    if (pinLockout.lockedForMs(lockKey) > 0) throw pinLocked();

    const fail = (): AppError => {
      pinLockout.recordFailure(lockKey);
      pinLockout.recordDailyFailure(dailyKey);
      return invalidCredentials();
    };

    let orgId: string | undefined;
    if (input.orgSlug) {
      const resolved = await portalRepository.findActiveOrgIdBySlug(input.orgSlug.trim().toLowerCase());
      if (!resolved) {
        await burnCompares(pin, LOGIN_COMPARE_COUNT);
        throw fail();
      }
      orgId = resolved;
    }

    const candidates = await portalRepository.findLoginCandidates(email, orgId, LOGIN_COMPARE_COUNT);

    const matches: LoginCandidate[] = [];
    let compared = 0;
    for (const candidate of candidates) {
      if (!candidate.portalPin || compared >= LOGIN_COMPARE_COUNT) continue;
      compared++;
      if (await bcrypt.compare(pin, candidate.portalPin)) matches.push(candidate);
    }
    // Always LOGIN_COMPARE_COUNT compares in total, however many real candidates exist.
    await burnCompares(pin, LOGIN_COMPARE_COUNT - compared);

    let matched: LoginCandidate | undefined = matches[0];
    const preferSlug = normalizeOrgSlug(input.preferOrgSlug);
    if (matches.length > 1 && preferSlug && !orgId) {
      const preferredOrgId = await portalRepository.findActiveOrgIdBySlug(preferSlug);
      if (preferredOrgId) matched = matches.find((m) => m.orgId === preferredOrgId) ?? matched;
    }
    if (!matched) throw fail();

    // Hardening: a freshly seeded default PIN is meant to be used once, via the
    // signed magic link in the client's SMS — not typed on this form. It is refused
    // with the SAME generic 401 as every other failure, so typing it never confirms
    // that the email has an account.
    if (matched.mustChangePin && pin === DEFAULT_PORTAL_PIN) throw fail();

    // Clears only the 5-in-15-minutes run. The daily budget is deliberately NOT reset by a
    // success, so the owner's own sign-ins cannot hand an attacker a fresh budget.
    pinLockout.reset(lockKey);

    const token = signPortalToken({ clientId: matched.id, email: matched.email || '', method: 'pin' });

    return {
      token,
      clientId: matched.id,
      firstName: matched.firstName,
      ...(await checkBiometric(matched.id)),
      mustChangePin: matched.mustChangePin,
    };
  },

  /** Exchange a short single-use code (from an SMS quote link) for a portal session. */
  async magicLogin(code: string): Promise<MagicLoginResult> {
    const redeemed = await portalLoginTokenRepository.redeem(String(code));
    if (!redeemed) {
      throw new AppError('That link has expired or was already used. Ask your agent for a new one, or use Forgotten your PIN?', 401);
    }

    const client = await portalRepository.findClientProfile(redeemed.clientId);
    if (!client) throw new AppError('Account not found', 401);

    const token = signPortalToken({ clientId: redeemed.clientId, email: client.email || '', method: 'magic-link' });
    return {
      token,
      clientId: redeemed.clientId,
      firstName: client.firstName,
      mustChangePin: client.mustChangePin,
    };
  },

  /**
   * Set the signed-in client's PIN and clear the must-change flag. When the session
   * came from a magic link (the forced "choose your PIN" step), the customer has just
   * proved themselves by setting their own PIN, so a fresh PIN-method session is
   * reissued — that is what lets them set up Face ID next. Any other session keeps
   * its token (a stolen long-lived token cannot upgrade itself this way).
   */
  async changePin(session: PortalTokenPayload, newPin: string): Promise<{ token?: string }> {
    if (!/^\d{4}$/.test(newPin)) throw new AppError('Valid 4-digit PIN required', 400);
    if (newPin === DEFAULT_PORTAL_PIN) throw new AppError('Please choose a PIN other than the default.', 400);
    const hash = await bcrypt.hash(newPin, 10);
    await neonClientRepository.setPortalPin(session.clientId, hash, { mustChange: false });
    if (session.method !== 'magic-link') return {};
    return { token: signPortalToken({ clientId: session.clientId, email: session.email, method: 'pin' }) };
  },
};

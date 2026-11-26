import { Router, type Response } from 'express';
import { createRateLimiter } from '../../middlewares/rate-limit.middleware';
import { noResponseLog } from '../../middlewares/no-response-log';
import { validate } from '../../middlewares/validation.middleware';
import { portalController } from './portal.controller';
import { portalAuth, portalErrorHandler } from './portal.middleware';
import { portalBookingDetailController } from './portal-booking-detail.controller';
import { portalBookingDetailValidator } from './portal-booking-detail.validator';
import {
  listPortalDealsValidator,
  portalChangePinValidator,
  portalDealFiltersValidator,
  portalForYouValidator,
  portalLoginValidator,
  portalMagicLoginValidator,
  portalWebauthnCheckValidator,
  portalWebauthnOptionsValidator,
  portalWebauthnLoginValidator,
  portalWebauthnRegisterValidator,
  portalWebauthnRemoveValidator,
} from './portal.validator';

/**
 * The portal's authentication, deals and bookings endpoints — the single live
 * implementation. It is mounted at /api/v2/portal (via portal.routes.ts) AND, as
 * an alias, on the legacy /api/portal router so cached PWA clients keep working
 * without the old v1 handlers running.
 */
export const portalCoreRouter = Router();

// Sign-in answers carry the session token: never let the global request logger print a portal body (also on the /api/portal alias).
portalCoreRouter.use(noResponseLog);

/** Plain-language 429 for the customer portal: it reads `{ error }`, not the staff envelope. */
export function portalRateLimitReply(res: Response, retryAfterSeconds: number): void {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  res.status(429).json({
    error: `Too many sign-in attempts. Please wait ${minutes} minute${minutes === 1 ? '' : 's'} and try again, or use the sign-in link we sent you.`,
  });
}

/** Same shape for the Face ID set-up endpoints, where "sign-in" would be the wrong words. */
export function portalSetupRateLimitReply(res: Response, retryAfterSeconds: number): void {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  res.status(429).json({
    error: `Too many attempts. Please wait ${minutes} minute${minutes === 1 ? '' : 's'} and try again.`,
  });
}

const newSignInLimiter = () => createRateLimiter({ max: 20, windowMs: 15 * 60 * 1000, onLimit: portalRateLimitReply });
const loginLimiter = newSignInLimiter();
const magicLoginLimiter = newSignInLimiter();
const webauthnLoginOptionsLimiter = newSignInLimiter();
const webauthnLoginLimiter = newSignInLimiter();
const newSetupLimiter = () => createRateLimiter({ max: 20, windowMs: 15 * 60 * 1000, onLimit: portalSetupRateLimitReply });
const webauthnRegisterOptionsLimiter = newSetupLimiter();
const webauthnRegisterLimiter = newSetupLimiter();
const webauthnManageLimiter = newSetupLimiter();

// ── Authentication ──────────────────────────────────────────────────────────
portalCoreRouter.post('/login', loginLimiter, validate(portalLoginValidator), portalController.login);
portalCoreRouter.post('/magic-login', magicLoginLimiter, validate(portalMagicLoginValidator), portalController.magicLogin);
portalCoreRouter.post('/change-pin', portalAuth, validate(portalChangePinValidator), portalController.changePin);

// ── WebAuthn (Face ID / Touch ID): two steps each, challenge verified server-side ──
portalCoreRouter.post('/webauthn/register/options', webauthnRegisterOptionsLimiter, portalAuth, validate(portalWebauthnOptionsValidator), portalController.webauthnRegisterOptions);
portalCoreRouter.post('/webauthn/register', webauthnRegisterLimiter, portalAuth, validate(portalWebauthnRegisterValidator), portalController.webauthnRegister);
portalCoreRouter.post('/webauthn/login/options', webauthnLoginOptionsLimiter, validate(portalWebauthnOptionsValidator), portalController.webauthnLoginOptions);
portalCoreRouter.post('/webauthn/login', webauthnLoginLimiter, validate(portalWebauthnLoginValidator), portalController.webauthnLogin);
portalCoreRouter.post('/webauthn/check', portalAuth, validate(portalWebauthnCheckValidator), portalController.webauthnCheck);

portalCoreRouter.get('/webauthn/credentials', portalAuth, portalController.webauthnCredentials);
portalCoreRouter.delete('/webauthn/credentials/:id', webauthnManageLimiter, portalAuth, validate(portalWebauthnRemoveValidator), portalController.webauthnRemove);

// ── Deals (agency-scoped; see portal-deals.service) ─────────────────────────
portalCoreRouter.get('/deals/filters', validate(portalDealFiltersValidator), portalController.dealFilters);
portalCoreRouter.get('/deals/for-you', portalAuth, validate(portalForYouValidator), portalController.forYouDeals);
portalCoreRouter.get('/deals', validate(listPortalDealsValidator), portalController.listDeals);

// ── Bookings ────────────────────────────────────────────────────────────────
portalCoreRouter.get('/bookings', portalAuth, portalController.bookings);
portalCoreRouter.get('/bookings/:id', portalAuth, validate(portalBookingDetailValidator), portalBookingDetailController.detail);

portalCoreRouter.use(portalErrorHandler);

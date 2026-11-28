import { Router } from 'express';
import { noResponseLog } from '../../middlewares/no-response-log';
import { portalController } from './portal.controller';
import { portalBrandingRouter } from './portal-branding.routes';
import { portalCoreRouter } from './portal-core.routes';
import { portalDocumentsRouter } from './portal-documents.routes';
import { portalPassportsRouter } from './portal-passports.routes';
import { portalPinResetRouter } from './portal-pin-reset.routes';
import { portalQuotesRouter } from './portal-quotes.routes';
import { portalSummaryRouter } from './portal-summary.routes';
import { portalWritesRouter } from './portal-writes.routes';
import { portalAuth, portalErrorHandler } from './portal.middleware';

const portalRouter = Router();

// Every portal response can carry a credential or personal data (session tokens, passport details, signed
// document links, bank details, chat): the global request logger must never print any portal body.
portalRouter.use(noResponseLog);

// Authentication, deals and bookings.
portalRouter.use(portalCoreRouter);

// Agency branding (public by slug, or the signed-in customer's own) and "Forgotten your PIN?".
portalRouter.use(portalBrandingRouter);
portalRouter.use(portalPinResetRouter);

// The customer's profile and quotes (list, detail, "interested / not interested", ownership, view logging).
portalRouter.use(portalQuotesRouter);

// Home's one-call summary (counts, next booking, soonest held price, rewards).
portalRouter.use(portalSummaryRouter);

// "My documents": the files on the customer's own profile (client_files only), listed and downloaded.
portalRouter.use(portalDocumentsRouter);

// Passengers and passports: the customer's saved travellers, reading a passport photo, saving confirmed details.
portalRouter.use(portalPassportsRouter);

// Messages and every other customer write: one shared router, also mounted by the legacy /api/portal.
portalRouter.use(portalWritesRouter);

// ── Tags ────────────────────────────────────────────────────────────────────
portalRouter.get('/tags', portalController.allTags);
portalRouter.get('/has-tags', portalAuth, portalController.hasTags);
portalRouter.get('/my-tags', portalAuth, portalController.myTags);

// ── Push notifications ──────────────────────────────────────────────────────
portalRouter.get('/push/vapid-key', portalController.vapidKey);

// Switch-over check (public): which host the server thinks it was asked on. Nothing else about the configuration.
portalRouter.get('/host-check', portalController.hostCheck);

// ── VIP / referral / wallet ─────────────────────────────────────────────────
portalRouter.get('/vip', portalAuth, portalController.vip);
portalRouter.get('/vip/referrals', portalAuth, portalController.vipReferrals);
portalRouter.get('/vip/payout-requests', portalAuth, portalController.vipPayoutRequests);
portalRouter.get('/vip/withdrawals', portalAuth, portalController.vipWithdrawals);
portalRouter.get('/wallet/balance', portalAuth, portalController.walletBalance);
portalRouter.get('/wallet/transactions', portalAuth, portalController.walletTransactions);

// Staff portal-PIN management lives in the neon-client module
// (GET/PUT/DELETE /api/v2/neon-clients/:id/portal-pin) where it is org-scoped.

portalRouter.use(portalErrorHandler);

export default portalRouter;

import { Router } from 'express';
import { validate } from '../../middlewares/validation.middleware';
import { portalController } from './portal.controller';
import { portalBrandingRouter } from './portal-branding.routes';
import { portalCoreRouter } from './portal-core.routes';
import { portalPinResetRouter } from './portal-pin-reset.routes';
import { portalQuotesRouter } from './portal-quotes.routes';
import { portalSummaryRouter } from './portal-summary.routes';
import { portalAuth, portalErrorHandler } from './portal.middleware';
import {
  portalInterestValidator,
  portalPushSubscribeValidator,
  portalPushUnsubscribeValidator,
  portalQuoteRequestValidator,
  portalSendMessageValidator,
  portalSetTagsValidator,
  portalWithdrawValidator,
} from './portal.validator';

const portalRouter = Router();

// Authentication, deals and bookings.
portalRouter.use(portalCoreRouter);

// Agency branding (public by slug, or the signed-in customer's own) and "Forgotten your PIN?".
portalRouter.use(portalBrandingRouter);
portalRouter.use(portalPinResetRouter);

// The customer's profile and quotes (list, detail, "interested / not interested", ownership, view logging).
portalRouter.use(portalQuotesRouter);

// Home's one-call summary (counts, next booking, soonest held price, rewards).
portalRouter.use(portalSummaryRouter);

// ── Messages ────────────────────────────────────────────────────────────────
portalRouter.get('/messages', portalAuth, portalController.messages);
portalRouter.post('/message', portalAuth, validate(portalSendMessageValidator), portalController.sendMessage);
portalRouter.post('/quote-request', portalAuth, validate(portalQuoteRequestValidator), portalController.quoteRequest);
portalRouter.post('/interest', portalAuth, validate(portalInterestValidator), portalController.interest);

// ── Tags ────────────────────────────────────────────────────────────────────
portalRouter.get('/tags', portalController.allTags);
portalRouter.get('/has-tags', portalAuth, portalController.hasTags);
portalRouter.get('/my-tags', portalAuth, portalController.myTags);
portalRouter.post('/my-tags', portalAuth, validate(portalSetTagsValidator), portalController.setMyTags);

// ── Push notifications ──────────────────────────────────────────────────────
portalRouter.get('/push/vapid-key', portalController.vapidKey);
portalRouter.post('/push/subscribe', portalAuth, validate(portalPushSubscribeValidator), portalController.pushSubscribe);
portalRouter.post('/push/unsubscribe', portalAuth, validate(portalPushUnsubscribeValidator), portalController.pushUnsubscribe);

// ── VIP / referral / wallet ─────────────────────────────────────────────────
portalRouter.get('/vip', portalAuth, portalController.vip);
portalRouter.get('/vip/referrals', portalAuth, portalController.vipReferrals);
portalRouter.get('/vip/payout-requests', portalAuth, portalController.vipPayoutRequests);
portalRouter.get('/vip/withdrawals', portalAuth, portalController.vipWithdrawals);
portalRouter.get('/wallet/balance', portalAuth, portalController.walletBalance);
portalRouter.get('/wallet/transactions', portalAuth, portalController.walletTransactions);
portalRouter.post('/wallet/request-payout', portalAuth, portalController.requestPayout);
portalRouter.post('/wallet/withdraw', portalAuth, validate(portalWithdrawValidator), portalController.withdraw);

// Staff portal-PIN management lives in the neon-client module
// (GET/PUT/DELETE /api/v2/neon-clients/:id/portal-pin) where it is org-scoped.

portalRouter.use(portalErrorHandler);

export default portalRouter;

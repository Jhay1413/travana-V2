import { Router } from 'express';
import { noResponseLog } from '../../middlewares/no-response-log';
import { validate } from '../../middlewares/validation.middleware';
import { createRateLimiter } from '../../middlewares/rate-limit.middleware';
import { portalController } from './portal.controller';
import { portalAuth, portalErrorHandler } from './portal.middleware';
import {
  portalInterestValidator,
  portalPushRetireValidator,
  portalPushSubscribeValidator,
  portalPushUnsubscribeValidator,
  portalQuoteRequestValidator,
  portalSendMessageValidator,
  portalSetTagsValidator,
  portalWithdrawValidator,
} from './portal.validator';

/**
 * The customer's chat and every other write the portal accepts (messages, quote request, interest, tags, push, wallet).
 * ONE router, mounted by the v2 portal router AND by the legacy /api/portal router, so both paths share the same
 * validators (message max 5000 characters), the same service and the same limits. Nothing here has a copy elsewhere.
 */
export const portalWritesRouter = Router();

portalWritesRouter.use(noResponseLog);

portalWritesRouter.get('/messages', portalAuth, portalController.messages);
portalWritesRouter.post('/message', portalAuth, validate(portalSendMessageValidator), portalController.sendMessage);
portalWritesRouter.post('/quote-request', portalAuth, validate(portalQuoteRequestValidator), portalController.quoteRequest);
portalWritesRouter.post('/interest', portalAuth, validate(portalInterestValidator), portalController.interest);

portalWritesRouter.post('/my-tags', portalAuth, validate(portalSetTagsValidator), portalController.setMyTags);

portalWritesRouter.post('/push/subscribe', portalAuth, validate(portalPushSubscribeValidator), portalController.pushSubscribe);
// No session: the retired old worker proves the subscription is its own with its endpoint and both keys. Per-IP capped.
const pushRetireLimiter = createRateLimiter({
  max: 30,
  windowMs: 15 * 60 * 1000,
  onLimit: (res) => {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
  },
});
portalWritesRouter.post('/push/retire', pushRetireLimiter, validate(portalPushRetireValidator), portalController.pushRetire);
portalWritesRouter.post('/push/unsubscribe', portalAuth, validate(portalPushUnsubscribeValidator), portalController.pushUnsubscribe);

portalWritesRouter.post('/wallet/request-payout', portalAuth, portalController.requestPayout);
portalWritesRouter.post('/wallet/withdraw', portalAuth, validate(portalWithdrawValidator), portalController.withdraw);

portalWritesRouter.use(portalErrorHandler);

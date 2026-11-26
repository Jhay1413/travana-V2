import { Router } from 'express';
import { validate } from '../../middlewares/validation.middleware';
import { portalController } from './portal.controller';
import { createClientRateLimiter } from './portal-client-rate-limit';
import { portalAuth, portalErrorHandler } from './portal.middleware';
import { portalQuotesController } from './portal-quotes.controller';
import { portalQuoteActionValidator, portalQuoteDetailValidator } from './portal-quotes.validator';
import { portalQuoteTokenValidator } from './portal.validator';

/**
 * The customer's profile and quotes: list, detail, "interested / not interested", ownership and view logging.
 * The single live implementation: mounted at /api/v2/portal AND, as an alias, on the legacy /api/portal router
 * (the old /user, /quotes and /quote/:token/* paths) so cached PWA clients keep working.
 */
export const portalQuotesRouter = Router();

/** Each action can notify the agent, so a customer cannot flip a decision back and forth without limit (per customer, after sign-in). */
const actionLimiter = createClientRateLimiter({
  max: 60,
  windowMs: 15 * 60 * 1000,
  message: 'Too many answers in a short time. Please wait a few minutes and try again.',
});

portalQuotesRouter.get('/user', portalAuth, portalController.profile);

portalQuotesRouter.get('/quotes', portalAuth, portalQuotesController.list);
portalQuotesRouter.get('/quotes/:token', portalAuth, validate(portalQuoteDetailValidator), portalQuotesController.detail);
portalQuotesRouter.post('/quotes/:token/action', portalAuth, actionLimiter, validate(portalQuoteActionValidator), portalQuotesController.action);

portalQuotesRouter.get('/quote/:token/owns', portalAuth, validate(portalQuoteTokenValidator), portalQuotesController.owns);
portalQuotesRouter.post('/quote/:token/view', portalAuth, validate(portalQuoteTokenValidator), portalController.quoteView);

portalQuotesRouter.use(portalErrorHandler);

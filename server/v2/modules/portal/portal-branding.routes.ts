import { Router } from 'express';
import { createRateLimiter } from '../../middlewares/rate-limit.middleware';
import { noResponseLog } from '../../middlewares/no-response-log';
import { validate } from '../../middlewares/validation.middleware';
import { portalBrandingController } from './portal-branding.controller';
import { portalBrandingBySlugValidator } from './portal-branding.validator';
import { portalAuth } from './portal.middleware';

export const portalBrandingRouter = Router();
portalBrandingRouter.use(noResponseLog);

// The public lookup is cheap but unauthenticated: a per-IP cap blunts slug guessing.
const publicBrandingLimiter = createRateLimiter({
  max: 60,
  windowMs: 60 * 1000,
  onLimit: (res) => {
    res.status(429).json({ error: 'Too many requests. Please try again in a moment.' });
  },
});

portalBrandingRouter.get('/branding', portalAuth, portalBrandingController.forSession);
portalBrandingRouter.get('/branding/:slug', publicBrandingLimiter, validate(portalBrandingBySlugValidator), portalBrandingController.forSlug);

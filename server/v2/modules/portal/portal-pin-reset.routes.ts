import { Router } from 'express';
import { createRateLimiter } from '../../middlewares/rate-limit.middleware';
import { validate } from '../../middlewares/validation.middleware';
import { portalPinResetController } from './portal-pin-reset.controller';
import { portalPinResetValidator } from './portal-pin-reset.validator';

export const portalPinResetRouter = Router();

// Per-IP cap on top of the per-email allowance: each text costs the agency money.
const pinResetIpLimiter = createRateLimiter({
  max: 10,
  windowMs: 15 * 60 * 1000,
  onLimit: (res, retryAfterSeconds) => {
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    res.status(429).json({ error: `Too many requests. Please wait ${minutes} minute${minutes === 1 ? '' : 's'} and try again.` });
  },
});

portalPinResetRouter.post('/pin-reset', pinResetIpLimiter, validate(portalPinResetValidator), portalPinResetController.requestReset);

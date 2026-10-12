import { Router } from 'express';
import { onboardingController } from './onboarding.controller';
import { validate } from '../../middlewares/validation.middleware';
import { createRateLimiter } from '../../middlewares/rate-limit.middleware';
import { signupSchema, verifyEmailSchema, resendVerificationSchema } from './onboarding.validator';

const router = Router();

const WINDOW_MS = 15 * 60 * 1000;
const signupLimiter = createRateLimiter({
  max: 5,
  windowMs: WINDOW_MS,
  message: 'Too many sign-up attempts — please try again in a few minutes.',
});
const resendLimiter = createRateLimiter({
  max: 10,
  windowMs: WINDOW_MS,
  message: 'Too many verification requests — please try again in a few minutes.',
});

// Self-serve signup — no auth required
router.post('/signup', signupLimiter, validate(signupSchema), onboardingController.signup);
router.get('/verify-email', validate(verifyEmailSchema), onboardingController.verifyEmail);
router.post('/resend-verification', resendLimiter, validate(resendVerificationSchema), onboardingController.resendVerification);

export default router;

import { Router } from 'express';
import { onboardingController } from './onboarding.controller';
import { validate } from '../../middlewares/validation.middleware';
import { signupSchema, verifyEmailSchema, resendVerificationSchema } from './onboarding.validator';

const router = Router();

// Self-serve signup — no auth required
router.post('/signup', validate(signupSchema), onboardingController.signup);
router.get('/verify-email', validate(verifyEmailSchema), onboardingController.verifyEmail);
router.post('/resend-verification', validate(resendVerificationSchema), onboardingController.resendVerification);

export default router;

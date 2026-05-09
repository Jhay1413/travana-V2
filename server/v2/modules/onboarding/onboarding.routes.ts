import { Router } from 'express';
import { onboardingController } from './onboarding.controller';

const router = Router();

// Self-serve signup — no auth required
router.post('/signup', onboardingController.signup);
router.get('/verify-email', onboardingController.verifyEmail);

export default router;

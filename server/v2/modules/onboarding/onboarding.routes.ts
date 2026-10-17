import { Router } from 'express';
import { onboardingController } from './onboarding.controller';
import { onboardingSetupController } from './onboarding-setup.controller';
import { validate } from '../../middlewares/validation.middleware';
import { createRateLimiter } from '../../middlewares/rate-limit.middleware';
import { isAuthenticated } from '../../middlewares/auth';
import { orgBranchScope } from '../../middlewares/org-branch-scope';
import { requireOrgRole } from '../../middlewares/auth/require-org-role';
import { signupSchema, verifyEmailSchema, resendVerificationSchema } from './onboarding.validator';
import { businessSchema, shopsSchema, homeworkerCommissionSchema } from './onboarding-setup.validator';

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

// Post-signup setup wizard — the org owner only
const ownerOnly = requireOrgRole(['org_admin']);
router.get('/state',                 isAuthenticated, orgBranchScope, ownerOnly, onboardingSetupController.getState);
router.put('/business',              isAuthenticated, orgBranchScope, ownerOnly, validate(businessSchema), onboardingSetupController.saveBusiness);
router.post('/shops',                isAuthenticated, orgBranchScope, ownerOnly, validate(shopsSchema), onboardingSetupController.addShops);
router.put('/homeworker-commission', isAuthenticated, orgBranchScope, ownerOnly, validate(homeworkerCommissionSchema), onboardingSetupController.setHomeworkerCommission);
router.post('/complete',             isAuthenticated, orgBranchScope, ownerOnly, onboardingSetupController.complete);

export default router;

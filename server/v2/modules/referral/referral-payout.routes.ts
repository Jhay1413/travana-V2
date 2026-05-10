import { Router } from 'express';
import { referralPayoutController } from './referral-payout.controller';
import { isAuthenticated } from '../../middlewares/auth';
import { orgBranchScope } from '../../middlewares/org-branch-scope';
import { requireOrgRole } from '../../middlewares/auth/require-org-role';
import { validate } from '../../middlewares/validation.middleware';
import { referralPayoutIdParamValidator, approveRejectPayoutValidator } from './referral-payout.validator';

const router = Router();

router.use(isAuthenticated, orgBranchScope, requireOrgRole(['org_admin', 'platform_admin', 'branch_manager']));

router.get('/', referralPayoutController.listPayouts);
router.get('/:id', validate(referralPayoutIdParamValidator), referralPayoutController.getPayoutById);
router.patch('/:id/approve', validate(approveRejectPayoutValidator), referralPayoutController.approvePayout);
router.patch('/:id/reject', validate(approveRejectPayoutValidator), referralPayoutController.rejectPayout);

export default router;

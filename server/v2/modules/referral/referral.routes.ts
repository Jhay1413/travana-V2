import { Router } from 'express';
import { referralController } from './referral.controller';
import { isAuthenticated } from '../../middlewares/auth';
import { orgBranchScope } from '../../middlewares/org-branch-scope';
import { requireOrgRole } from '../../middlewares/auth/require-org-role';
import { validate } from '../../middlewares/validation.middleware';
import {
  createReferralValidator,
  updateReferralValidator,
  updateReferralStatusValidator,
  referralIdParamValidator,
  referrerClientParamValidator,
} from './referral.validator';

const router = Router();

router.use(isAuthenticated, orgBranchScope, requireOrgRole(['org_admin', 'platform_admin', 'branch_manager']));

router.get('/', referralController.listReferrals);
router.get('/client/:clientId', validate(referrerClientParamValidator), referralController.getReferralsByClient);
router.get('/client/:clientId/stats', validate(referrerClientParamValidator), referralController.getClientStats);
router.get('/client/:clientId/vip-overview', validate(referrerClientParamValidator), referralController.getClientVipOverview);
router.get('/:id', validate(referralIdParamValidator), referralController.getReferralById);
router.post('/', validate(createReferralValidator), referralController.createReferral);
router.patch('/:id', validate(updateReferralValidator), referralController.updateReferral);
router.patch('/:id/status', validate(updateReferralStatusValidator), referralController.updateStatus);
router.delete('/:id', validate(referralIdParamValidator), referralController.deleteReferral);

export default router;

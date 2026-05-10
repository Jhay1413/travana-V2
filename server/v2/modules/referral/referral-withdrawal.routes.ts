import { Router } from 'express';
import { referralWithdrawalController } from './referral-withdrawal.controller';
import { isAuthenticated } from '../../middlewares/auth';
import { orgBranchScope } from '../../middlewares/org-branch-scope';
import { requireOrgRole } from '../../middlewares/auth/require-org-role';
import { validate } from '../../middlewares/validation.middleware';
import {
  withdrawalIdParamValidator,
  processWithdrawalValidator,
  rejectWithdrawalValidator,
} from './referral-withdrawal.validator';

const router = Router();

router.use(isAuthenticated, orgBranchScope, requireOrgRole(['org_admin', 'platform_admin', 'branch_manager']));

router.get('/', referralWithdrawalController.listWithdrawals);
router.get('/:id', validate(withdrawalIdParamValidator), referralWithdrawalController.getWithdrawalById);
router.patch('/:id/process', validate(processWithdrawalValidator), referralWithdrawalController.processWithdrawal);
router.patch('/:id/reject', validate(rejectWithdrawalValidator), referralWithdrawalController.rejectWithdrawal);
router.get('/:id/invoice', validate(withdrawalIdParamValidator), referralWithdrawalController.getInvoiceUrl);

export default router;

import { Router } from 'express';
import { referralWithdrawalController } from './referral-withdrawal.controller';
import { validate } from '../../middlewares/validation.middleware';
import {
  withdrawalIdParamValidator,
  processWithdrawalValidator,
  rejectWithdrawalValidator,
} from './referral-withdrawal.validator';

const router = Router();

router.get('/', referralWithdrawalController.listWithdrawals);
router.get('/:id', validate(withdrawalIdParamValidator), referralWithdrawalController.getWithdrawalById);
router.patch('/:id/process', validate(processWithdrawalValidator), referralWithdrawalController.processWithdrawal);
router.patch('/:id/reject', validate(rejectWithdrawalValidator), referralWithdrawalController.rejectWithdrawal);
router.get('/:id/invoice', validate(withdrawalIdParamValidator), referralWithdrawalController.getInvoiceUrl);

export default router;

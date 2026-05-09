import { Router } from 'express';
import { referralPayoutController } from './referral-payout.controller';
import { validate } from '../../middlewares/validation.middleware';
import { referralPayoutIdParamValidator, approveRejectPayoutValidator } from './referral-payout.validator';

const router = Router();

router.get('/', referralPayoutController.listPayouts);
router.get('/:id', validate(referralPayoutIdParamValidator), referralPayoutController.getPayoutById);
router.patch('/:id/approve', validate(approveRejectPayoutValidator), referralPayoutController.approvePayout);
router.patch('/:id/reject', validate(approveRejectPayoutValidator), referralPayoutController.rejectPayout);

export default router;

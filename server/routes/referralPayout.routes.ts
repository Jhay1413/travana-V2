import { Router } from "express";
import { referralPayoutController } from "../controllers/referralPayout.controller";
import { validate } from "../middlewares/validation.middleware";
import {
  referralPayoutIdParamValidator,
  approveRejectPayoutValidator,
} from "../validators/referralPayout.validator";

const router = Router();

// Admin: list all payout requests
router.get("/", referralPayoutController.listPayouts);

// Admin: get a single payout request
router.get("/:id", validate(referralPayoutIdParamValidator), referralPayoutController.getPayoutById);

// Admin: approve a payout request (PENDING referral → IN_WALLET, referral_payout → approved)
router.patch("/:id/approve", validate(approveRejectPayoutValidator), referralPayoutController.approvePayout);

// Admin: reject a payout request (referral stays PENDING, referral_payout → rejected)
router.patch("/:id/reject", validate(approveRejectPayoutValidator), referralPayoutController.rejectPayout);

export default router;

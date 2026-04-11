import { Router } from "express";
import { referralController } from "../controllers/referral.controller";
import { validate } from "../middlewares/validation.middleware";
import {
  createReferralValidator,
  updateReferralValidator,
  updateReferralStatusValidator,
  updatePayoutTypeValidator,
  referralIdParamValidator,
  referrerClientParamValidator,
} from "../validators/referral.validator";

const router = Router();

// Admin: list all referrals
router.get("/", referralController.listReferrals);

// Admin: get referrals by client (referrer)
router.get("/client/:clientId", validate(referrerClientParamValidator), referralController.getReferralsByClient);

// Admin: get single referral
router.get("/:id", validate(referralIdParamValidator), referralController.getReferralById);

// Admin: log a new referral at time of friend's booking
router.post("/", validate(createReferralValidator), referralController.createReferral);

// Admin: update referral details (travel date, commission, payout type)
router.patch("/:id", validate(updateReferralValidator), referralController.updateReferral);

// Admin: update referral status (PENDING → IN_WALLET → PAID / VOIDED)
router.patch("/:id/status", validate(updateReferralStatusValidator), referralController.updateStatus);

// Client/Admin: set preferred payout method
router.patch("/:id/payout-type", validate(updatePayoutTypeValidator), referralController.updatePayoutType);

// Admin: void/delete a referral (e.g. cancelled trip)
router.delete("/:id", validate(referralIdParamValidator), referralController.deleteReferral);

export default router;

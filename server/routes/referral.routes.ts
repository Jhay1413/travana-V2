import { Router } from "express";
import { referralController } from "../controllers/referral.controller";
import { validate } from "../middlewares/validation.middleware";
import {
  createReferralValidator,
  updateReferralValidator,
  updateReferralStatusValidator,
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

// Admin: update referral details (travel date, commission)
router.patch("/:id", validate(updateReferralValidator), referralController.updateReferral);

// Admin: update referral status manually (emergency override)
router.patch("/:id/status", validate(updateReferralStatusValidator), referralController.updateStatus);

// Admin: void/delete a referral (e.g. cancelled trip)
router.delete("/:id", validate(referralIdParamValidator), referralController.deleteReferral);

export default router;

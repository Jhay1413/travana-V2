import { Router } from "express";
import { vipPayoutController } from "../controllers/vipPayout.controller";
import { validate } from "../middlewares/validation.middleware";
import {
  createVipPayoutValidator,
  processVipPayoutValidator,
  vipPayoutIdParamValidator,
} from "../validators/vipPayout.validator";

const router = Router();

// Admin: list all payouts
router.get("/", vipPayoutController.listPayouts);

// Admin: get single payout
router.get("/:id", validate(vipPayoutIdParamValidator), vipPayoutController.getPayoutById);

// Admin: create a payout record for a referral
router.post("/", validate(createVipPayoutValidator), vipPayoutController.createPayout);

// Admin: mark payout as processed
router.patch("/:id/process", validate(processVipPayoutValidator), vipPayoutController.processPayout);

export default router;

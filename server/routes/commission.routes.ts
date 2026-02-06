import { Router } from "express";
import { commissionController } from "../controllers/commission.controller";
import { validate } from "../middlewares/validation.middleware";
import { createCommissionValidator, updateCommissionValidator } from "../validators/commission.validator";

const router = Router();

router.get("/quote/:quoteId", commissionController.getByQuoteId);
router.post("/", validate(createCommissionValidator), commissionController.createCommission);
router.patch("/:id", validate(updateCommissionValidator), commissionController.updateCommission);

export default router;

import { Router } from "express";
import { usageController } from "./usage.controller";
import { validate } from "../../middlewares/validation.middleware";
import { usageHistoryQuerySchema } from "./usage.validator";

const router = Router();

router.get("/summary", usageController.getSummary);
router.get("/history", validate(usageHistoryQuerySchema), usageController.getHistory);

export default router;

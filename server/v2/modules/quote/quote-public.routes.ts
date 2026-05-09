import { Router } from "express";
import { quotePublicController } from "./quote-public.controller";
import { validate } from "../../middlewares/validation.middleware";
import { customerActionSchema } from "./quote-public.validator";

const router = Router();

router.get("/:token", quotePublicController.getQuote);
router.post("/:token/view", quotePublicController.logView);
router.post("/:token/action", validate(customerActionSchema), quotePublicController.handleAction);

export default router;

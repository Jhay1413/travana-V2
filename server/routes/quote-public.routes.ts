import { Router } from "express";
import { quotePublicController } from "../controllers/quote-public.controller";
import { validate } from "../middlewares/validation.middleware";
import { customerActionSchema } from "../validators/quote-public.validator";

const publicRouter = Router();

publicRouter.get("/:token", quotePublicController.getQuote);
publicRouter.post("/:token/view", quotePublicController.logView);
publicRouter.post("/:token/action", validate(customerActionSchema), quotePublicController.handleAction);
publicRouter.post("/:token/share", quotePublicController.logShare);

export default publicRouter;

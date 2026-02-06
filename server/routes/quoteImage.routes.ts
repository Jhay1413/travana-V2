import { Router } from "express";
import { quoteImageController } from "../controllers/quoteImage.controller";
import { validate } from "../middlewares/validation.middleware";
import { createQuoteImageValidator } from "../validators/quoteImage.validator";

const router = Router();

router.get("/quote/:quoteId", quoteImageController.listByQuoteId);
router.post("/", validate(createQuoteImageValidator), quoteImageController.createQuoteImage);
router.delete("/:id", quoteImageController.deleteQuoteImage);

export default router;

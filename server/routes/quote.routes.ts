import { Router } from "express";
import { quoteController } from "../controllers/quote.controller";
import { validate } from "../middlewares/validation.middleware";
import { createQuoteValidator, updateQuoteValidator } from "../validators/quote.validator";

const router = Router();

router.get("/", quoteController.listQuotes);
router.get("/:id", quoteController.getQuoteById);
router.get("/:id/full", quoteController.getQuoteFullDetails);
router.post("/", validate(createQuoteValidator), quoteController.createQuote);
router.patch("/:id", validate(updateQuoteValidator), quoteController.updateQuote);
router.delete("/:id", quoteController.deleteQuote);

export default router;

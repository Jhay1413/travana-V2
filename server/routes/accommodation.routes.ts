import { Router } from "express";
import { accommodationController } from "../controllers/accommodation.controller";
import { validate } from "../middlewares/validation.middleware";
import { createAccommodationValidator, updateAccommodationValidator } from "../validators/accommodation.validator";

const router = Router();

router.get("/quote/:quoteId", accommodationController.getByQuoteId);
router.post("/", validate(createAccommodationValidator), accommodationController.createAccommodation);
router.patch("/:id", validate(updateAccommodationValidator), accommodationController.updateAccommodation);

export default router;

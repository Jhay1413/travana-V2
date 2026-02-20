import { Router } from "express";
import { quoteController } from "../controllers/quote.controller";
import { quoteImageController } from "../controllers/quote-image.controller";
import { validate } from "../middlewares/validation.middleware";
import { addImagesValidator } from "../validators/quote-image.validator";

const router = Router();

router.get("/free", quoteController.listFreeQuotes);
router.get("/", quoteController.listQuotes);
router.get("/:id", quoteController.getQuoteById);
router.post("/", quoteController.createQuote);
router.post("/:id/duplicate", quoteController.duplicateQuote);
router.patch("/:id", quoteController.updateQuote);
router.delete("/:id", quoteController.deleteQuote);

router.post("/:id/flights", quoteController.addFlight);
router.patch("/:id/flights/:flightId", quoteController.updateFlight);
router.delete("/:id/flights/:flightId", quoteController.removeFlight);

router.post("/:id/accommodations", quoteController.addAccommodation);
router.patch("/:id/accommodations/:accommodationId", quoteController.updateAccommodation);
router.delete("/:id/accommodations/:accommodationId", quoteController.removeAccommodation);

router.post("/:id/transfers", quoteController.addTransfer);
router.delete("/:id/transfers/:transferId", quoteController.removeTransfer);

router.post("/:id/passengers", quoteController.addPassenger);
router.delete("/:id/passengers/:passengerId", quoteController.removePassenger);

router.post("/:quoteId/images", validate(addImagesValidator), quoteImageController.addImages);
router.get("/:quoteId/images", quoteImageController.getImages);
router.delete("/:quoteId/images/:imageId", quoteImageController.deleteImage);
router.patch("/:quoteId/images/:imageId/primary", quoteImageController.setPrimaryImage);

// Tag management
router.put("/:id/tags", quoteController.updateQuoteTags);
router.get("/:id/tags", quoteController.getQuoteTags);

export default router;

import { Router } from "express";
import { quoteController } from "../controllers/quote.controller";

const router = Router();

router.get("/", quoteController.listQuotes);
router.get("/:id", quoteController.getQuoteById);
router.post("/", quoteController.createQuote);
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

export default router;

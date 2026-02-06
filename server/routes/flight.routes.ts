import { Router } from "express";
import { flightController } from "../controllers/flight.controller";
import { validate } from "../middlewares/validation.middleware";
import { createFlightValidator, updateFlightValidator } from "../validators/flight.validator";

const router = Router();

router.get("/quote/:quoteId", flightController.listByQuoteId);
router.post("/", validate(createFlightValidator), flightController.createFlight);
router.patch("/:id", validate(updateFlightValidator), flightController.updateFlight);

export default router;

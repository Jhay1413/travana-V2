import { Router } from "express";
import { airportController } from "../controllers/airport.controller";
import { validate } from "../middlewares/validation.middleware";
import { createAirportValidator } from "../validators/airport.validator";

const router = Router();

router.get("/", airportController.listAirports);
router.post("/", validate(createAirportValidator), airportController.createAirport);
router.delete("/:id", airportController.deleteAirport);

export default router;

import { Router } from "express";
import { tourOperatorController } from "../controllers/tourOperator.controller";
import { validate } from "../middlewares/validation.middleware";
import { createTourOperatorValidator, updateTourOperatorValidator } from "../validators/tourOperator.validator";

const router = Router();

router.get("/", tourOperatorController.listTourOperators);
router.get("/:id", tourOperatorController.getTourOperatorById);
router.post("/", validate(createTourOperatorValidator), tourOperatorController.createTourOperator);
router.patch("/:id", validate(updateTourOperatorValidator), tourOperatorController.updateTourOperator);
router.delete("/:id", tourOperatorController.deleteTourOperator);

export default router;

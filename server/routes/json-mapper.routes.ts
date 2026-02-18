import { Router } from "express";
import { jsonMapperController } from "../controllers/json-mapper.controller";
import { validate } from "../middlewares/validation.middleware";
import { mapToIdsValidator } from "../validators/json-mapper.validator";

const router = Router();

router.post(
  "/map-to-ids",
  validate(mapToIdsValidator),
  jsonMapperController.mapToIds
);

export default router;

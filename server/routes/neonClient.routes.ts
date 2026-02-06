import { Router } from "express";
import { neonClientController } from "../controllers/neonClient.controller";
import { validate } from "../middlewares/validation.middleware";
import { createNeonClientValidator, updateNeonClientValidator } from "../validators/neonClient.validator";

const router = Router();

router.get("/", neonClientController.listNeonClients);
router.get("/:id", neonClientController.getNeonClientById);
router.post("/", validate(createNeonClientValidator), neonClientController.createNeonClient);
router.patch("/:id", validate(updateNeonClientValidator), neonClientController.updateNeonClient);
router.delete("/:id", neonClientController.deleteNeonClient);

export default router;

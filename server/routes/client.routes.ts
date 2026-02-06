import { Router } from "express";
import { clientController } from "../controllers/client.controller";
import { validate } from "../middlewares/validation.middleware";
import { createClientValidator, updateClientValidator } from "../validators/client.validator";

const router = Router();

router.get("/", clientController.listClients);
router.get("/:id", clientController.getClientById);
router.post("/", validate(createClientValidator), clientController.createClient);
router.patch("/:id", validate(updateClientValidator), clientController.updateClient);
router.delete("/:id", clientController.deleteClient);

export default router;

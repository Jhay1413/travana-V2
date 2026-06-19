import { Router } from "express";
import { clientController } from "./client.controller";
import { validate } from "../../middlewares/validation.middleware";
import { createClientValidator, updateClientValidator, mergeClientValidator } from "./client.validator";

const router = Router();

router.get("/", clientController.listClients);
router.get("/:id", clientController.getClientById);
router.post("/", validate(createClientValidator), clientController.createClient);
router.post("/:id/merge", validate(mergeClientValidator), clientController.mergeClient);
router.patch("/:id", validate(updateClientValidator), clientController.updateClient);
router.delete("/:id", clientController.deleteClient);

export default router;

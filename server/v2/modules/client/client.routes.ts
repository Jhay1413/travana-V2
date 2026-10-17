import { Router } from "express";
import { clientController } from "./client.controller";
import { validate } from "../../middlewares/validation.middleware";
import { blockReadOnlyClientRoles } from "../../middlewares/auth/block-read-only-roles";
import { createClientValidator, updateClientValidator, mergeClientValidator } from "./client.validator";

const router = Router();

router.get("/", clientController.listClients);
router.get("/:id", clientController.getClientById);
router.post("/", blockReadOnlyClientRoles, validate(createClientValidator), clientController.createClient);
router.post("/:id/merge", blockReadOnlyClientRoles, validate(mergeClientValidator), clientController.mergeClient);
router.patch("/:id", blockReadOnlyClientRoles, validate(updateClientValidator), clientController.updateClient);
router.delete("/:id", blockReadOnlyClientRoles, clientController.deleteClient);

export default router;

import { Router } from "express";
import { clientController } from "./client.controller";
import { validate } from "../../middlewares/validation.middleware";
import { requireOrgRole } from "../../middlewares/auth/require-org-role";
import { CLIENT_DELETE_ROLES } from "./client.service";
import { blockReadOnlyClientRoles } from "../../middlewares/auth/block-read-only-roles";
import { createClientValidator, updateClientValidator, mergeClientValidator } from "./client.validator";

const router = Router();

router.get("/", clientController.listClients);
router.get("/:id", clientController.getClientById);
router.post("/", blockReadOnlyClientRoles, validate(createClientValidator), clientController.createClient);
router.post("/:id/merge", blockReadOnlyClientRoles, validate(mergeClientValidator), clientController.mergeClient);
router.patch("/:id", blockReadOnlyClientRoles, validate(updateClientValidator), clientController.updateClient);
// Soft delete, admin only (org_admin / platform_admin).
router.delete("/:id", requireOrgRole([...CLIENT_DELETE_ROLES]), clientController.deleteClient);

export default router;

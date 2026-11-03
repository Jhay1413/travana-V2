import { Router } from "express";
import { denyOrgRole, requireAnyOrgRole } from "../../middlewares/auth/require-org-role";
import { validate } from "../../middlewares/validation.middleware";
import { whatsappTemplatesController as c } from "./whatsapp-templates.controller";
import { createTemplateValidator, syncTemplatesValidator } from "./whatsapp-templates.validator";

const router = Router();

// Managers only, never homeworkers; applies to every route below.
router.use(requireAnyOrgRole(["org_admin", "branch_manager", "platform_admin"]), denyOrgRole(["homeworker"]));

// Static /sync before the /:id param.
router.get("/", c.list);
router.post("/sync", validate(syncTemplatesValidator), c.sync);
router.post("/", validate(createTemplateValidator), c.create);
router.delete("/:id", c.remove);

export default router;

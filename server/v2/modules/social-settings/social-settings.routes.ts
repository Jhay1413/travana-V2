import { Router } from "express";
import { requireOrgRole } from "../../middlewares/auth/require-org-role";
import type { OrgRole } from "../../utils/scope";
import { validate } from "../../middlewares/validation.middleware";
import { socialSettingsController as c } from "./social-settings.controller";
import { updateSocialSettingsValidator } from "./social-settings.validator";

const router = Router();

const WRITE_ROLES: OrgRole[] = ["platform_admin", "org_admin", "branch_manager", "social_media_manager"];

router.get("/", c.get);
router.get("/channel", c.getChannel);
router.put("/", requireOrgRole(WRITE_ROLES), validate(updateSocialSettingsValidator), c.update);

export default router;

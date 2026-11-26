import { Router } from "express";
import { denyOrgRole, requireAnyOrgRole } from "../../middlewares/auth/require-org-role";
import { validate } from "../../middlewares/validation.middleware";
import { customerMessagingController as c } from "./customer-messaging.controller";
import { AUTO_PURPOSES } from "./customer-messaging.types";
import { purposeParamsValidator, saveSwitchValidator, savePurposeTemplateValidator, saveCustomerMessagingSettingsValidator } from "./customer-messaging.validator";

const router = Router();

// Managers only, never homeworkers (same rule as the WhatsApp template settings); applies to every route below.
router.use(requireAnyOrgRole(["org_admin", "branch_manager", "platform_admin"]), denyOrgRole(["homeworker"]));

router.get("/settings", c.getSettings);
router.put("/settings", validate(saveCustomerMessagingSettingsValidator), c.saveSettings);
router.get("/readiness", c.getReadiness);
router.put("/switch/:purpose", validate(saveSwitchValidator), c.setSwitch);
router.get("/templates/:purpose", validate(purposeParamsValidator), c.getPurposeTemplate);
// The body rules differ per message type, so each type has its own validated route.
for (const purpose of AUTO_PURPOSES) {
  router.put(`/templates/${purpose}`, validate(savePurposeTemplateValidator(purpose)), c.savePurposeTemplate(purpose));
}

export default router;

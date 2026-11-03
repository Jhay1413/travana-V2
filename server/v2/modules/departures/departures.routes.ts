import { Router } from "express";
import { requireOrgRole } from "../../middlewares/auth/require-org-role";
import { validate } from "../../middlewares/validation.middleware";
import { departuresController } from "./departures.controller";
import { listValidator, patchCheckValidator, summaryValidator } from "./departures.validator";

const router = Router();

// The service re-checks scope on every call (fail closed).
router.use(requireOrgRole(["platform_admin", "org_admin", "branch_manager"]));

router.get("/", validate(listValidator), departuresController.list);
// Declared before any /:bookingId route so "summary" is never read as an id.
router.get("/summary", validate(summaryValidator), departuresController.summary);
router.patch("/:bookingId/checks", validate(patchCheckValidator), departuresController.setCheck);

export default router;

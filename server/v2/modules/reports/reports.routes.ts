import { Router } from "express";
import { reportsController } from "./reports.controller";
import { requireOrgRole } from "../../middlewares/auth/require-org-role";

const router = Router();

const managerOnly = requireOrgRole(["branch_manager", "org_admin", "platform_admin"]);

router.get("/sales", managerOnly, reportsController.getSales);
router.get("/agents", managerOnly, reportsController.getAgents);
router.get("/lead-source", managerOnly, reportsController.getLeadSource);
router.get("/targets-vs-actuals", managerOnly, reportsController.getTargetsVsActuals);

export default router;

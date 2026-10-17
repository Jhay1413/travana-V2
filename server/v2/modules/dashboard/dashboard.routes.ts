import { Router } from "express";
import { dashboardController } from "./dashboard.controller";
import { requireOrgRole } from "../../middlewares/auth/require-org-role";

const router = Router();

const adminOnly = requireOrgRole(["org_admin", "platform_admin"]);

router.get("/stats", adminOnly, dashboardController.getStats);
router.get("/my-profit", dashboardController.getMyProfit);
router.get("/agent-stats", dashboardController.getAgentStats);
router.get("/admin-overview-stats", adminOnly, dashboardController.getAdminOverviewStats);

export default router;

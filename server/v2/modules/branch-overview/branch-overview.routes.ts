import { Router } from "express";
import { branchOverviewController } from "./branch-overview.controller";
import { requireOrgRole } from "../../middlewares/auth/require-org-role";

const router = Router();

router.get(
  "/stats",
  requireOrgRole(["branch_manager", "org_admin", "platform_admin"]),
  branchOverviewController.getStats,
);

router.get(
  "/agents-performance",
  requireOrgRole(["branch_manager", "org_admin", "platform_admin"]),
  branchOverviewController.getAgentsPerformance,
);

export default router;

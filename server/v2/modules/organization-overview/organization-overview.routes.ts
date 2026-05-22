import { Router } from "express";
import { organizationOverviewController } from "./organization-overview.controller";
import { requireOrgRole } from "../../middlewares/auth/require-org-role";

const router = Router();

router.get(
  "/stats",
  requireOrgRole(["org_admin", "platform_admin"]),
  organizationOverviewController.getStats,
);

router.get(
  "/agents-performance",
  requireOrgRole(["org_admin", "platform_admin"]),
  organizationOverviewController.getAgentsPerformance,
);

router.get(
  "/branches-performance",
  requireOrgRole(["org_admin", "platform_admin"]),
  organizationOverviewController.getBranchesPerformance,
);

export default router;

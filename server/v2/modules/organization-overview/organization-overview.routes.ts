import { Router } from "express";
import { organizationOverviewController } from "./organization-overview.controller";
import { requireOrgRole } from "../../middlewares/auth/require-org-role";
import { validate } from "../../middlewares/validation.middleware";
import { getStatsValidator, getPerformanceValidator } from "./organization-overview.validator";

const router = Router();

router.get(
  "/stats",
  requireOrgRole(["org_admin", "platform_admin"]),
  validate(getStatsValidator),
  organizationOverviewController.getStats,
);

router.get(
  "/agents-performance",
  requireOrgRole(["org_admin", "platform_admin"]),
  validate(getPerformanceValidator),
  organizationOverviewController.getAgentsPerformance,
);

router.get(
  "/branches-performance",
  requireOrgRole(["org_admin", "platform_admin"]),
  validate(getPerformanceValidator),
  organizationOverviewController.getBranchesPerformance,
);

export default router;

import { Router } from "express";
import { organizationOverviewController } from "./organization-overview.controller";
import { requireOrgRole } from "../../middlewares/auth/require-org-role";
import { validate } from "../../middlewares/validation.middleware";
import {
  getStatsValidator,
  getPerformanceValidator,
  getCompareValidator,
  getProfitSourcesValidator,
} from "./organization-overview.validator";

// platform_admin passes requireOrgRole, but the service fails closed (403) without an org context.
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

router.get(
  "/compare",
  requireOrgRole(["org_admin", "platform_admin"]),
  validate(getCompareValidator),
  organizationOverviewController.getCompare,
);

router.get(
  "/profit-sources",
  requireOrgRole(["org_admin", "platform_admin"]),
  validate(getProfitSourcesValidator),
  organizationOverviewController.getProfitSources,
);

export default router;

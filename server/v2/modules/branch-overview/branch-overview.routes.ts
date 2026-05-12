import { Router } from "express";
import { branchOverviewController } from "./branch-overview.controller";
import { requireOrgRole } from "../../middlewares/auth/require-org-role";

const router = Router();

router.get(
  "/stats",
  requireOrgRole(["branch_manager", "org_admin", "platform_admin"]),
  branchOverviewController.getStats,
);

export default router;

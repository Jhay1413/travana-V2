import express from "express";
import { requireOrgRole } from "../../middlewares/auth/require-org-role";
import { validate } from "../../middlewares/validation.middleware";
import * as targetsController from "./targets.controller";
import {
  branchQueryValidator,
  upsertShopTargetsValidator,
  upsertAgentTargetsValidator,
  yearQueryValidator,
  monthsBodyValidator,
  overrideBodyValidator,
  revertOverrideValidator,
  allocationValidator,
} from "./targets.validator";

const router = express.Router();

const canWriteTargets = requireOrgRole(["org_admin", "branch_manager", "platform_admin"]);
// Shop targets belong to the organisation admin; branch managers only allocate to their agents.
const canWriteShopTargets = requireOrgRole(["org_admin", "platform_admin"]);
const isOrgAdmin = requireOrgRole(["org_admin", "platform_admin"]);

router.get("/overview", validate(branchQueryValidator), targetsController.getTargetsOverview);

router.get("/shop", validate(branchQueryValidator), targetsController.getShopTargets);
router.post("/shop", canWriteShopTargets, validate(upsertShopTargetsValidator), targetsController.upsertShopTargets);

router.get("/agent", validate(branchQueryValidator), targetsController.getAgentTargets);
router.get("/agent/:userId", validate(branchQueryValidator), targetsController.getAgentTargetsByUserId);
router.post("/agent", canWriteTargets, validate(upsertAgentTargetsValidator), targetsController.upsertAgentTargets);

router.get("/agents", validate(branchQueryValidator), targetsController.getAgents);

// Redesign: whole-year view and writes. Role scoping lives in the service.
router.get("/year", validate(yearQueryValidator), targetsController.getYear);
router.put("/business", isOrgAdmin, validate(monthsBodyValidator), targetsController.setBusiness);
router.put("/mine", validate(monthsBodyValidator), targetsController.setMine);
router.put(
  "/homeworkers/:userId/override",
  isOrgAdmin,
  validate(overrideBodyValidator),
  targetsController.setHomeworkerOverride,
);
router.delete(
  "/homeworkers/:userId/override",
  isOrgAdmin,
  validate(revertOverrideValidator),
  targetsController.revertHomeworkerOverride,
);
router.post("/allocation", validate(allocationValidator), targetsController.saveAllocation);

export default router;

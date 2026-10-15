import express from "express";
import { requireOrgRole } from "../../middlewares/auth/require-org-role";
import { validate } from "../../middlewares/validation.middleware";
import * as targetsController from "./targets.controller";
import { branchQueryValidator, upsertShopTargetsValidator, upsertAgentTargetsValidator } from "./targets.validator";

const router = express.Router();

const canWriteTargets = requireOrgRole(["org_admin", "branch_manager", "platform_admin"]);

router.get("/overview", validate(branchQueryValidator), targetsController.getTargetsOverview);

router.get("/shop", validate(branchQueryValidator), targetsController.getShopTargets);
router.post("/shop", canWriteTargets, validate(upsertShopTargetsValidator), targetsController.upsertShopTargets);

router.get("/agent", validate(branchQueryValidator), targetsController.getAgentTargets);
router.get("/agent/:userId", validate(branchQueryValidator), targetsController.getAgentTargetsByUserId);
router.post("/agent", canWriteTargets, validate(upsertAgentTargetsValidator), targetsController.upsertAgentTargets);

router.get("/agents", validate(branchQueryValidator), targetsController.getAgents);

export default router;

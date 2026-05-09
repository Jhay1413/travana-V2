import express from "express";
import * as targetsController from "./targets.controller";

const router = express.Router();

router.get("/overview", targetsController.getTargetsOverview);

router.get("/shop", targetsController.getShopTargets);
router.post("/shop", targetsController.upsertShopTargets);

router.get("/agent", targetsController.getAgentTargets);
router.get("/agent/:userId", targetsController.getAgentTargetsByUserId);
router.post("/agent", targetsController.upsertAgentTargets);

router.get("/agents", targetsController.getAgents);

export default router;

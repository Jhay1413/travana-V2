import express from "express";
import * as targetsController from "../controllers/targets.controller";

const router = express.Router();

// ─── Overview ───────────────────────────────────────────────────────────
router.get("/overview", targetsController.getTargetsOverview);

// ─── Shop Targets ───────────────────────────────────────────────────────────
router.get("/shop", targetsController.getShopTargets);
router.post("/shop", targetsController.upsertShopTargets);

// ─── Agent Targets ───────────────────────────────────────────────────────────
router.get("/agent", targetsController.getAgentTargets);
router.get("/agent/:userId", targetsController.getAgentTargetsByUserId);
router.post("/agent", targetsController.upsertAgentTargets);

// ─── Agents ───────────────────────────────────────────────────────────
router.get("/agents", targetsController.getAgents);

export default router;

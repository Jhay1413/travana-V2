import type { Request, Response } from "express";
import * as targetsService from "../services/targets.service";
import type { ShopTargetInput, AgentTargetInput } from "../types/targets/targets.types";

// ─── Get Targets Overview ───────────────────────────────────────────────────────────

export async function getTargetsOverview(req: Request, res: Response) {
  try {
    const overview = await targetsService.getTargetsOverview();
    res.json(overview);
  } catch (error) {
    console.error("Error fetching targets overview:", error);
    res.status(500).json({ 
      error: "Failed to fetch targets overview",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// ─── Get Shop Targets ───────────────────────────────────────────────────────────

export async function getShopTargets(req: Request, res: Response) {
  try {
    const targets = await targetsService.getAllShopTargets();
    res.json(targets);
  } catch (error) {
    console.error("Error fetching shop targets:", error);
    res.status(500).json({ 
      error: "Failed to fetch shop targets",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// ─── Upsert Shop Targets ───────────────────────────────────────────────────────────

export async function upsertShopTargets(req: Request, res: Response) {
  try {
    const { targets } = req.body as { targets: ShopTargetInput[] };

    if (!targets || !Array.isArray(targets)) {
      return res.status(400).json({ error: "Invalid request body. Expected { targets: ShopTargetInput[] }" });
    }

    if (targets.length === 0) {
      return res.status(400).json({ error: "Targets array cannot be empty" });
    }

    const result = await targetsService.upsertShopTargets(targets);
    res.json(result);
  } catch (error) {
    console.error("Error upserting shop targets:", error);
    res.status(500).json({ 
      error: "Failed to upsert shop targets",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// ─── Get Agent Targets ───────────────────────────────────────────────────────────

export async function getAgentTargets(req: Request, res: Response) {
  try {
    const targets = await targetsService.getAllAgentTargets();
    res.json(targets);
  } catch (error) {
    console.error("Error fetching agent targets:", error);
    res.status(500).json({ 
      error: "Failed to fetch agent targets",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// ─── Get Agent Targets by User ID ───────────────────────────────────────────────────────────

export async function getAgentTargetsByUserId(req: Request, res: Response) {
  try {
    let { userId } = req.params;

    // Handle array case (Express can return string | string[])
    if (Array.isArray(userId)) {
      userId = userId[0];
    }

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const targets = await targetsService.getAgentTargetsByUserId(userId);
    res.json(targets);
  } catch (error) {
    console.error("Error fetching agent targets by user ID:", error);
    res.status(500).json({ 
      error: "Failed to fetch agent targets",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// ─── Upsert Agent Targets ───────────────────────────────────────────────────────────

export async function upsertAgentTargets(req: Request, res: Response) {
  try {
    const { targets } = req.body as { targets: AgentTargetInput[] };

    if (!targets || !Array.isArray(targets)) {
      return res.status(400).json({ error: "Invalid request body. Expected { targets: AgentTargetInput[] }" });
    }

    if (targets.length === 0) {
      return res.status(400).json({ error: "Targets array cannot be empty" });
    }

    const result = await targetsService.upsertAgentTargets(targets);
    res.json(result);
  } catch (error) {
    console.error("Error upserting agent targets:", error);
    res.status(500).json({ 
      error: "Failed to upsert agent targets",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// ─── Get Agents ───────────────────────────────────────────────────────────

export async function getAgents(req: Request, res: Response) {
  try {
    const agents = await targetsService.getAllAgents();
    res.json(agents);
  } catch (error) {
    console.error("Error fetching agents:", error);
    res.status(500).json({ 
      error: "Failed to fetch agents",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

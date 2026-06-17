import type { Request, Response } from "express";
import * as targetsService from "./targets.service";
import { getScope } from "../../utils/scope";
import { AppError } from "../../utils/error-handler";
import type { ShopTargetInput, AgentTargetInput } from "./targets.types";

function branchOverrideFrom(req: Request): string | undefined {
  const fromQuery = (req.query.branchId as string);
  if (typeof fromQuery === "string" && fromQuery.length > 0) return fromQuery;
  const fromBody = (req.body && typeof req.body === "object") ? (req.body as any).branchId : undefined;
  if (typeof fromBody === "string" && fromBody.length > 0) return fromBody;
  return undefined;
}

function handleError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.message,
      message: error.message,
    });
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({
    error: fallbackMessage,
    message: error instanceof Error ? error.message : "Unknown error",
  });
}

export async function getTargetsOverview(req: Request, res: Response) {
  try {
    const overview = await targetsService.getTargetsOverview(getScope(req), branchOverrideFrom(req));
    res.json(overview);
  } catch (error) {
    return handleError(res, error, "Failed to fetch targets overview");
  }
}

export async function getShopTargets(req: Request, res: Response) {
  try {
    const targets = await targetsService.getAllShopTargets(getScope(req), branchOverrideFrom(req));
    res.json(targets);
  } catch (error) {
    return handleError(res, error, "Failed to fetch shop targets");
  }
}

export async function upsertShopTargets(req: Request, res: Response) {
  try {
    const { targets } = req.body as { targets: ShopTargetInput[]; branchId?: string };

    if (!targets || !Array.isArray(targets)) {
      return res.status(400).json({ error: "Invalid request body. Expected { targets: ShopTargetInput[] }" });
    }
    if (targets.length === 0) {
      return res.status(400).json({ error: "Targets array cannot be empty" });
    }

    const result = await targetsService.upsertShopTargets(getScope(req), targets, branchOverrideFrom(req));
    res.json(result);
  } catch (error) {
    return handleError(res, error, "Failed to upsert shop targets");
  }
}

export async function getAgentTargets(req: Request, res: Response) {
  try {
    const targets = await targetsService.getAllAgentTargets(getScope(req), branchOverrideFrom(req));
    res.json(targets);
  } catch (error) {
    return handleError(res, error, "Failed to fetch agent targets");
  }
}

export async function getAgentTargetsByUserId(req: Request, res: Response) {
  try {
    let { userId } = req.params as Record<string, string>;
    if (Array.isArray(userId)) userId = userId[0];
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const targets = await targetsService.getAgentTargetsByUserId(getScope(req), userId, branchOverrideFrom(req));
    res.json(targets);
  } catch (error) {
    return handleError(res, error, "Failed to fetch agent targets");
  }
}

export async function upsertAgentTargets(req: Request, res: Response) {
  try {
    const { targets } = req.body as { targets: AgentTargetInput[]; branchId?: string };

    if (!targets || !Array.isArray(targets)) {
      return res.status(400).json({ error: "Invalid request body. Expected { targets: AgentTargetInput[] }" });
    }
    if (targets.length === 0) {
      return res.status(400).json({ error: "Targets array cannot be empty" });
    }

    const result = await targetsService.upsertAgentTargets(getScope(req), targets, branchOverrideFrom(req));
    res.json(result);
  } catch (error) {
    return handleError(res, error, "Failed to upsert agent targets");
  }
}

export async function getAgents(req: Request, res: Response) {
  try {
    const agents = await targetsService.getAllAgents(getScope(req), branchOverrideFrom(req));
    res.json(agents);
  } catch (error) {
    return handleError(res, error, "Failed to fetch agents");
  }
}

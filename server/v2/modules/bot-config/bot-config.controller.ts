import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";
import { getScope } from "../../utils/scope";
import { botConfigService } from "./bot-config.service";
import type { BotConfigInput } from "./bot-config.repository";

// Org-admin management of the org's AI bot. Org-scoped via getScope(req).orgId.

export const botConfigController = {
  // GET /api/v2/bot-config
  get: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await botConfigService.getStatus(getScope(req).orgId), "Bot config");
  }),

  // PUT /api/v2/bot-config
  update: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const status = await botConfigService.update(scope.orgId, req.body as BotConfigInput, scope.userId);
    return successResponse(res, status, "Bot config saved");
  }),

  // POST /api/v2/bot-config/enable
  enable: asyncHandler(async (req: Request, res: Response) => {
    const { mode } = (req.body ?? {}) as { mode?: string };
    return successResponse(res, await botConfigService.enable(getScope(req).orgId, mode), "AI auto-reply enabled");
  }),

  // POST /api/v2/bot-config/disable
  disable: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await botConfigService.disable(getScope(req).orgId), "AI auto-reply disabled");
  }),

  // PUT /api/v2/bot-config/mode
  setMode: asyncHandler(async (req: Request, res: Response) => {
    const { mode } = req.body as { mode: string };
    return successResponse(res, await botConfigService.setMode(getScope(req).orgId, mode), "Mode updated");
  }),
};

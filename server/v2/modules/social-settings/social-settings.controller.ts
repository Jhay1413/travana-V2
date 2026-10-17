import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";
import { getScope } from "../../utils/scope";
import { socialSettingsService } from "./social-settings.service";
import type { SocialSettingsInput } from "./social-settings.types";

export const socialSettingsController = {
  // GET /api/v2/social-settings
  get: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await socialSettingsService.get(getScope(req).orgId), "Social settings retrieved successfully");
  }),

  // PUT /api/v2/social-settings
  update: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const view = await socialSettingsService.update(scope.orgId, req.body as SocialSettingsInput, scope.userId);
    return successResponse(res, view, "Social settings saved");
  }),

  // GET /api/v2/social-settings/channel
  getChannel: asyncHandler(async (_req: Request, res: Response) => {
    return successResponse(res, socialSettingsService.getChannel(), "Social channel retrieved successfully");
  }),
};

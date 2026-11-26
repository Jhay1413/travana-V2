import type { Request, RequestHandler, Response } from "express";
import type { AutoMessagePurpose } from "@shared/schema";
import { asyncHandler } from "../../utils/async-handler";
import { AppError } from "../../utils/error-handler";
import { getUserId } from "../../utils/get-user-id";
import { getScope } from "../../utils/scope";
import { successResponse } from "../../utils/response";
import { whatsappSettingsService } from "../whatsapp-templates/whatsapp-settings.service";
import type { WhatsappTemplateSettings } from "../whatsapp-templates/whatsapp-templates.types";
import { customerMessagingReadinessService } from "./customer-messaging-readiness.service";
import { customerMessagingService } from "./customer-messaging.service";
import type { AutoChannel } from "./customer-messaging.types";

function requireOrgId(req: Request): string {
  const orgId = getScope(req).orgId;
  if (!orgId) throw new AppError("No organisation in scope", 400);
  return orgId;
}

export const customerMessagingController = {
  // GET /api/v2/customer-messaging/settings
  getSettings: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await customerMessagingService.getSettings(requireOrgId(req)), "Customer messaging settings retrieved");
  }),

  // PUT /api/v2/customer-messaging/settings
  saveSettings: asyncHandler(async (req: Request, res: Response) => {
    const { autoChannel } = req.body as { autoChannel: AutoChannel };
    return successResponse(res, await customerMessagingService.setAutoChannel(requireOrgId(req), autoChannel), "Customer messaging settings saved");
  }),

  // PUT /api/v2/customer-messaging/switch/:purpose  (turns the type on or off for the caller's own agency)
  setSwitch: asyncHandler(async (req: Request, res: Response) => {
    const purpose = req.params.purpose as AutoMessagePurpose;
    const { active } = req.body as { active: boolean };
    return successResponse(res, await customerMessagingService.setSwitch(requireOrgId(req), purpose, active), "Message type updated");
  }),

  // GET /api/v2/customer-messaging/readiness
  getReadiness: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await customerMessagingReadinessService.getReadiness(requireOrgId(req)), "Readiness retrieved");
  }),

  // GET /api/v2/customer-messaging/templates/:purpose  (purpose validated by the route)
  getPurposeTemplate: asyncHandler(async (req: Request, res: Response) => {
    const purpose = req.params.purpose as AutoMessagePurpose;
    return successResponse(res, await whatsappSettingsService.getPurposeTemplate(requireOrgId(req), purpose), "Template retrieved");
  }),

  // PUT /api/v2/customer-messaging/templates/<purpose>  (one route per purpose, body validated for that purpose)
  savePurposeTemplate(purpose: AutoMessagePurpose): RequestHandler {
    return asyncHandler(async (req: Request, res: Response) => {
      const data = await whatsappSettingsService.savePurposeTemplate(requireOrgId(req), purpose, req.body as WhatsappTemplateSettings, getUserId(req));
      return successResponse(res, data, "Template saved");
    });
  },
};

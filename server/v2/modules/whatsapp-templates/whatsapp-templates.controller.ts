import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";
import { AppError } from "../../utils/error-handler";
import { getScope } from "../../utils/scope";
import { getUserId } from "../../utils/get-user-id";
import { whatsappSettingsService } from "./whatsapp-settings.service";
import { whatsappTemplatesService } from "./whatsapp-templates.service";
import { createTemplateBodySchema } from "./whatsapp-templates.validator";
import type { TemplateListQuery, WhatsappTemplateSettings } from "./whatsapp-templates.types";

function requireOrgId(req: Request): string {
  const orgId = getScope(req).orgId;
  if (!orgId) throw new AppError("No organisation in scope", 400);
  return orgId;
}

function queryString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

export const whatsappTemplatesController = {
  // GET /api/v2/whatsapp-templates/portal-sign-in-settings
  getPortalSignInSettings: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await whatsappSettingsService.getPinReset(requireOrgId(req)), "Portal sign-in link template retrieved");
  }),

  // PUT /api/v2/whatsapp-templates/portal-sign-in-settings
  savePortalSignInSettings: asyncHandler(async (req: Request, res: Response) => {
    const data = await whatsappSettingsService.savePinReset(requireOrgId(req), req.body as WhatsappTemplateSettings, getUserId(req));
    return successResponse(res, data, "Portal sign-in link template saved");
  }),

  // GET /api/v2/whatsapp-templates?channel_id=&status=
  list: asyncHandler(async (req: Request, res: Response) => {
    const query: TemplateListQuery = {};
    const channelId = queryString(req.query.channel_id);
    const status = queryString(req.query.status);
    if (channelId) query.channel_id = channelId;
    if (status) query.status = status;
    return successResponse(res, await whatsappTemplatesService.list(query), "WhatsApp templates retrieved");
  }),

  // POST /api/v2/whatsapp-templates/sync  (body validated by syncTemplatesValidator)
  sync: asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as { channel_id: string };
    return successResponse(res, await whatsappTemplatesService.sync(body.channel_id), "WhatsApp templates synced");
  }),

  // POST /api/v2/whatsapp-templates  (validate() doesn't write back, so re-parse to apply defaults)
  create: asyncHandler(async (req: Request, res: Response) => {
    const input = createTemplateBodySchema.parse(req.body);
    return successResponse(res, await whatsappTemplatesService.create(input), "Template submitted for review", 201);
  }),

  // DELETE /api/v2/whatsapp-templates/:id
  remove: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string | undefined;
    if (!id) throw new AppError("Missing id", 400);
    return successResponse(res, await whatsappTemplatesService.remove(id), "Template deleted");
  }),
};

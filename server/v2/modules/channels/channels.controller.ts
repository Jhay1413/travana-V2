import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";
import { AppError } from "../../utils/error-handler";
import { channelsService } from "./channels.service";

// Connecting/disconnecting a channel means authorising the org's own social
// accounts — an org-admin/manager action. Reads are open to any staff member.
const MANAGER_ROLES = new Set(["org_admin", "branch_manager", "platform_admin"]);

// SendSeven's connect-token flow only accepts these types (SMS/email are
// provisioned via other flows) — filtering here avoids opaque 422s.
const CONNECTABLE_TYPES = new Set(["whatsapp", "messenger", "instagram", "telegram", "gmail"]);

function requireChannelManager(req: Request): void {
  const roles = req.orgRoles ?? [];
  const ok = roles.some((r) => MANAGER_ROLES.has(r)) || MANAGER_ROLES.has(req.orgRole ?? "");
  if (!ok) throw new AppError("Only organisation admins can manage channels", 403);
}

function requireParam(req: Request, name: string): string {
  const value = req.params[name] as string | undefined;
  if (!value) throw new AppError(`Missing ${name}`, 400);
  return value;
}

export const channelsController = {
  // GET /api/v2/channels
  list: asyncHandler(async (req: Request, res: Response) => {
    const forCompose = req.query.for_compose === "true" || req.query.forCompose === "true";
    return successResponse(res, await channelsService.listChannels(forCompose || undefined), "Channels retrieved");
  }),

  // GET /api/v2/channels/types
  types: asyncHandler(async (_req: Request, res: Response) => {
    return successResponse(res, await channelsService.channelTypes(), "Channel types retrieved");
  }),

  // POST /api/v2/channels/connect-token
  createConnectToken: asyncHandler(async (req: Request, res: Response) => {
    requireChannelManager(req);
    const body = (req.body ?? {}) as { allowed_channel_types?: string[]; partner_redirect_url?: string; name?: string };
    if (!Array.isArray(body.allowed_channel_types) || body.allowed_channel_types.length === 0) {
      throw new AppError("allowed_channel_types is required", 400);
    }
    const types = body.allowed_channel_types.map((t) => t.toLowerCase()).filter((t) => CONNECTABLE_TYPES.has(t));
    if (types.length === 0) {
      throw new AppError(
        `Unsupported channel type(s). Connectable types: ${Array.from(CONNECTABLE_TYPES).join(", ")}`,
        400,
      );
    }
    const result = await channelsService.createConnectToken({
      allowed_channel_types: types,
      partner_redirect_url: body.partner_redirect_url ?? null,
      name: body.name ?? null,
    });
    return successResponse(res, result, "Connect link generated", 201);
  }),

  // DELETE /api/v2/channels/:channelId
  remove: asyncHandler(async (req: Request, res: Response) => {
    requireChannelManager(req);
    await channelsService.deleteChannel(requireParam(req, "channelId"));
    return successResponse(res, { ok: true }, "Channel disconnected");
  }),

  // GET /api/v2/channels/whatsapp/:channelId/status
  whatsappStatus: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await channelsService.whatsappStatus(requireParam(req, "channelId")), "WhatsApp status");
  }),
};

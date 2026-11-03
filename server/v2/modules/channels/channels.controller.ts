import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";
import { AppError } from "../../utils/error-handler";
import { channelsService } from "./channels.service";
import type { ConnectTokenCreate, DelegateConnectCreate } from "./channels.types";

// Connecting/disconnecting a channel means authorising the org's own social
// accounts — an org-admin/manager action. Reads are open to any staff member.
const MANAGER_ROLES = new Set(["org_admin", "branch_manager", "platform_admin"]);

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

  // GET /api/v2/channels/status  -> { provisioned }
  status: asyncHandler(async (_req: Request, res: Response) => {
    return successResponse(res, await channelsService.workspaceStatus(), "Workspace status retrieved");
  }),

  // GET /api/v2/channels/health
  health: asyncHandler(async (_req: Request, res: Response) => {
    return successResponse(res, await channelsService.channelHealth(), "Channel health retrieved");
  }),

  // POST /api/v2/channels/connect-token  (body validated by connectTokenValidator)
  createConnectToken: asyncHandler(async (req: Request, res: Response) => {
    requireChannelManager(req);
    const body = req.body as ConnectTokenCreate;
    const payload: ConnectTokenCreate = {
      allowed_channel_types: body.allowed_channel_types,
      partner_redirect_url: body.partner_redirect_url ?? null,
      name: body.name ?? null,
    };
    if (body.expires_in_hours !== undefined) payload.expires_in_hours = body.expires_in_hours;
    if (body.max_uses !== undefined) payload.max_uses = body.max_uses;
    if (body.partner_name !== undefined) payload.partner_name = body.partner_name;
    const result = await channelsService.createConnectToken(payload);
    return successResponse(res, result, "Connect link generated", 201);
  }),

  // POST /api/v2/channels/connect-token/delegate  (body validated by delegateConnectValidator)
  delegateConnect: asyncHandler(async (req: Request, res: Response) => {
    requireChannelManager(req);
    const body = req.body as DelegateConnectCreate;
    const payload: DelegateConnectCreate = {
      email: body.email,
      channel_types: body.channel_types,
      recipient_name: body.recipient_name ?? null,
      note: body.note ?? null,
    };
    if (body.expires_in_hours !== undefined) payload.expires_in_hours = body.expires_in_hours;
    const result = await channelsService.delegateConnect(payload);
    return successResponse(res, result, "Connect link sent", 201);
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

import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";
import { AppError } from "../../utils/error-handler";
import { getUserId } from "../../utils/get-user-id";
import { conversationIntegrationService } from "./conversation-integration.service";
import { sendsevenWebhookService } from "../sendseven-webhook/sendseven-webhook.service";

// Managing a tenant's SendSeven token is a PLATFORM-ADMIN action, scoped to a
// target org via :orgId. The router mounts these behind requirePlatformAdmin.

function requireOrgId(req: Request): string {
  const orgId = req.params.orgId as string | undefined;
  if (!orgId) throw new AppError("Missing orgId", 400);
  return orgId;
}

export const conversationIntegrationController = {
  // GET /api/v2/conversation-integration  — summary across all orgs (org list)
  listStatuses: asyncHandler(async (_req: Request, res: Response) => {
    return successResponse(res, await conversationIntegrationService.listStatuses(), "Integration statuses");
  }),

  // GET /api/v2/conversation-integration/:orgId
  getStatus: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await conversationIntegrationService.getStatus(requireOrgId(req)), "Integration status");
  }),

  // PUT /api/v2/conversation-integration/:orgId
  setToken: asyncHandler(async (req: Request, res: Response) => {
    const { token, baseUrl } = (req.body ?? {}) as { token?: string; baseUrl?: string };
    if (!token || !token.trim()) throw new AppError("token is required", 400);
    const status = await conversationIntegrationService.setToken(requireOrgId(req), token, baseUrl ?? null, getUserId(req));
    return successResponse(res, status, "SendSeven integration saved");
  }),

  // DELETE /api/v2/conversation-integration/:orgId
  remove: asyncHandler(async (req: Request, res: Response) => {
    await conversationIntegrationService.remove(requireOrgId(req));
    return successResponse(res, { ok: true }, "SendSeven integration removed");
  }),

  // POST /api/v2/conversation-integration/:orgId/test
  test: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await conversationIntegrationService.testConnection(requireOrgId(req)), "Connection test complete");
  }),

  // POST /api/v2/conversation-integration/:orgId/auto-reply — register the webhook + enable
  enableAutoReply: asyncHandler(async (req: Request, res: Response) => {
    const { mode } = (req.body ?? {}) as { mode?: string };
    const result = await sendsevenWebhookService.connectWebhook(requireOrgId(req), { mode, autoReply: true });
    return successResponse(res, result, "AI auto-reply enabled");
  }),

  // DELETE /api/v2/conversation-integration/:orgId/auto-reply — tears the webhook
  // down entirely (platform-admin teardown). To silence only the bot and keep the
  // realtime inbox, use POST /api/v2/bot-config/disable instead.
  disableAutoReply: asyncHandler(async (req: Request, res: Response) => {
    await sendsevenWebhookService.disconnectWebhook(requireOrgId(req));
    return successResponse(res, { ok: true }, "Webhook disconnected");
  }),
};

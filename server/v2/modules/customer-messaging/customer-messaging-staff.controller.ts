import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { AppError } from "../../utils/error-handler";
import { getUserId } from "../../utils/get-user-id";
import { getScope } from "../../utils/scope";
import { successResponse } from "../../utils/response";
import { customerMessagingAvailabilityService } from "./customer-messaging-availability.service";
import { customerMessagingLogService } from "./customer-messaging-log.service";
import { customerMessagingStaffSendService } from "./customer-messaging-staff-send.service";
import type { StaffPurpose, StaffSendInput } from "./customer-messaging-staff.types";
import type { AutoChannel } from "./customer-messaging.types";

function requireUserId(req: Request): string {
  const userId = getUserId(req);
  if (!userId) throw new AppError("Not authenticated", 401);
  return userId;
}

// HTTP only: the query and body were already validated by the route.
export const customerMessagingStaffController = {
  // GET /api/v2/customer-messaging/availability?clientId=&purpose=
  getAvailability: asyncHandler(async (req: Request, res: Response) => {
    const { clientId, purpose } = req.query as { clientId: string; purpose: StaffPurpose };
    return successResponse(res, await customerMessagingAvailabilityService.getAvailability({ clientId, purpose }, getScope(req)), "Availability retrieved");
  }),

  // POST /api/v2/customer-messaging/send
  send: asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as { clientId: string; purpose: StaffPurpose; channel: AutoChannel; quoteId?: string };
    const input: StaffSendInput = { clientId: body.clientId, purpose: body.purpose, channel: body.channel, ...(body.quoteId ? { quoteId: body.quoteId } : {}) };
    const result = await customerMessagingStaffSendService.send(input, requireUserId(req), getScope(req));
    return successResponse(res, result, result.status === "sent" ? "Message sent" : "Message not sent");
  }),

  // GET /api/v2/customer-messaging/log?clientId=&limit=&cursor=
  getLog: asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as { clientId: string; limit?: string; cursor?: string };
    const page = await customerMessagingLogService.list(
      { clientId: q.clientId, ...(q.limit ? { limit: Number(q.limit) } : {}), ...(q.cursor ? { cursor: q.cursor } : {}) },
      getScope(req),
    );
    return successResponse(res, page, "Message history retrieved");
  }),
};

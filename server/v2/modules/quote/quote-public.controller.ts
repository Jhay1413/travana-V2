import { Request, Response } from "express";
import { quotePublicService } from "./quote-public.service";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";

export const quotePublicController = {
  getQuote: asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;
    const data = await quotePublicService.getQuoteByToken(token);
    return successResponse(res, data);
  }),

  logView: asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;
    const ua = req.headers["user-agent"] || "";

    let deviceType = "desktop";
    if (/mobile|android|iphone|ipad/i.test(ua)) {
      deviceType = /ipad|tablet/i.test(ua) ? "tablet" : "mobile";
    }

    let browser = "Unknown";
    if (/edg/i.test(ua)) browser = "Edge";
    else if (/chrome/i.test(ua)) browser = "Chrome";
    else if (/firefox/i.test(ua)) browser = "Firefox";
    else if (/safari/i.test(ua)) browser = "Safari";
    else if (/opera|opr/i.test(ua)) browser = "Opera";

    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "";

    const view = await quotePublicService.logView(token, {
      ipAddress: ip.substring(0, 45),
      deviceType,
      browser,
      userAgent: ua.substring(0, 500),
    });

    return successResponse(res, { viewId: view.id });
  }),

  handleAction: asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;
    const { actionType, message, customerName } = req.body;

    const trimmedMessage = typeof message === "string" ? message.substring(0, 2000) : null;
    const trimmedName = typeof customerName === "string" ? customerName.substring(0, 200) : null;

    const action = await quotePublicService.handleCustomerAction(
      token,
      actionType,
      trimmedMessage,
      trimmedName,
    );

    return successResponse(res, action);
  }),

  logShare: asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;
    const { method } = req.body;

    await quotePublicService.logShare(token, method || "unknown");

    return successResponse(res, null);
  }),
};

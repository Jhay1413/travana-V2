import type { NextFunction, Request, Response } from "express";
import { quotePublicService } from "./quote-public.service";
import { QuoteBlockedError, type PublicShareMethod } from "./quote-public.types";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";
import { getScope } from "../../utils/scope";

/** A blocked quote answers 410 with { error, code, agency } and nothing else; every other error goes to the global handler. */
function answerBlockedOrForward(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof QuoteBlockedError) {
    res.status(410).json(err.body);
    return;
  }
  next(err);
}

function deviceOf(ua: string): { deviceType: string; browser: string } {
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
  return { deviceType, browser };
}

export const quotePublicController = {
  getQuote: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { token } = req.params as Record<string, string>;
    try {
      const data = await quotePublicService.getPublicQuote(token);
      return successResponse(res, data);
    } catch (err) {
      return answerBlockedOrForward(err, res, next);
    }
  }),

  /** Staff only (mounted behind the session and org scope): the quote in any state, never recording a view. */
  previewQuote: asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params as Record<string, string>;
    const data = await quotePublicService.getPreviewQuote(token, getScope(req));
    return successResponse(res, data);
  }),

  logView: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { token } = req.params as Record<string, string>;
    const ua = req.headers["user-agent"] || "";
    // req.ip honours the app's trust-proxy setting; the raw X-Forwarded-For header is client-controlled.
    const ip = req.ip || req.socket.remoteAddress || "";

    try {
      const view = await quotePublicService.logView(token, {
        ipAddress: ip.substring(0, 45),
        ...deviceOf(ua),
        userAgent: ua.substring(0, 500),
      });
      return successResponse(res, { viewId: view.id });
    } catch (err) {
      return answerBlockedOrForward(err, res, next);
    }
  }),

  logShare: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { token } = req.params as Record<string, string>;
    const { method } = req.body as { method: PublicShareMethod };

    try {
      await quotePublicService.logShare(token, method);
      return successResponse(res, null);
    } catch (err) {
      return answerBlockedOrForward(err, res, next);
    }
  }),
};

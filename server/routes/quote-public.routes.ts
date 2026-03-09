import { Router, Request, Response } from "express";
import { quotePublicRepository } from "../repositories/quote-public.repository";

const publicRouter = Router();

publicRouter.get("/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const data = await quotePublicRepository.findByToken(token);
    if (!data) {
      return res.status(404).json({ success: false, error: "Quote not found" });
    }
    res.json({ success: true, data });
  } catch (err: any) {
    console.error("Error fetching public quote:", err);
    res.status(500).json({ success: false, error: "Failed to load quote" });
  }
});

publicRouter.post("/:token/view", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const quoteId = await quotePublicRepository.findQuoteIdByToken(token);
    if (!quoteId) {
      return res.status(404).json({ success: false, error: "Quote not found" });
    }

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

    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";

    const view = await quotePublicRepository.logView(quoteId, {
      ipAddress: ip.substring(0, 45),
      deviceType,
      browser,
      userAgent: ua.substring(0, 500),
    });

    const quoteData = await quotePublicRepository.findByToken(token);
    const dest = quoteData?.destinationName || "their holiday";
    await quotePublicRepository.notifyAgent(
      quoteId,
      "Quote Viewed",
      `A customer just viewed their quote for ${dest}`,
    );

    res.json({ success: true, data: { viewId: view.id } });
  } catch (err: any) {
    console.error("Error logging quote view:", err);
    res.status(500).json({ success: false, error: "Failed to log view" });
  }
});

publicRouter.post("/:token/action", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { actionType, message, customerName } = req.body;

    if (!actionType || !["accepted", "changes_requested"].includes(actionType)) {
      return res.status(400).json({ success: false, error: "Invalid action type" });
    }

    const trimmedMessage = typeof message === "string" ? message.substring(0, 2000) : null;
    const trimmedName = typeof customerName === "string" ? customerName.substring(0, 200) : null;

    const quoteId = await quotePublicRepository.findQuoteIdByToken(token);
    if (!quoteId) {
      return res.status(404).json({ success: false, error: "Quote not found" });
    }

    const action = await quotePublicRepository.createCustomerAction({
      quoteId,
      actionType,
      message: trimmedMessage,
      customerName: trimmedName,
    });

    const actionLabel = actionType === "accepted" ? "wants to book" : "has requested changes";
    const quoteData = await quotePublicRepository.findByToken(token);
    const dest = quoteData?.destinationName || "their holiday";
    const name = trimmedName || "A customer";
    await quotePublicRepository.notifyAgent(
      quoteId,
      actionType === "accepted" ? "Quote Accepted!" : "Changes Requested",
      `${name} ${actionLabel} on the ${dest} quote${trimmedMessage ? `: "${trimmedMessage}"` : ""}`,
    );

    res.json({ success: true, data: action });
  } catch (err: any) {
    console.error("Error processing customer action:", err);
    res.status(500).json({ success: false, error: "Failed to process action" });
  }
});

export default publicRouter;

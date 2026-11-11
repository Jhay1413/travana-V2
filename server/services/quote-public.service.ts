import { quotePublicRepository } from "../repositories/quote-public.repository";
import { AppError } from "../utils/error-handler";
import { customerPrice } from "../v2/utils/customer-price";
import type { InsertQuoteView } from "@shared/schema";

export const quotePublicService = {
  async getQuoteByToken(token: string) {
    const data = await quotePublicRepository.findByToken(token);
    if (!data) throw new AppError("Quote not found", 404);
    // Total = sales − discount + service charge + extras not in the package; per person is the holiday price only.
    const price = customerPrice(data);
    return {
      ...data,
      totalPrice: price.total.toFixed(2),
      pricePerPerson: price.pricePerPerson.toFixed(2),
    };
  },

  async logView(token: string, viewData: Omit<InsertQuoteView, "quoteId">) {
    const quoteId = await quotePublicRepository.findQuoteIdByToken(token);
    if (!quoteId) throw new AppError("Quote not found", 404);

    const view = await quotePublicRepository.logView(quoteId, viewData);

    // Public (non-portal) views are still counted for analytics, but we no
    // longer notify the agent or add a transaction note — only portal views
    // create a "Quote Viewed" note.
    return view;
  },

  async handleCustomerAction(
    token: string,
    actionType: "accepted" | "changes_requested",
    message: string | null,
    customerName: string | null,
  ) {
    const quoteId = await quotePublicRepository.findQuoteIdByToken(token);
    if (!quoteId) throw new AppError("Quote not found", 404);

    const action = await quotePublicRepository.createCustomerAction({
      quoteId,
      actionType,
      message,
      customerName,
    });

    const actionLabel = actionType === "accepted" ? "wants to book" : "has requested changes";
    const quoteData = await quotePublicRepository.findByToken(token);
    const dest = quoteData?.destinationName || "their holiday";
    const name = customerName || "A customer";

    await quotePublicRepository.notifyAgent(
      quoteId,
      actionType === "accepted" ? "Quote Accepted!" : "Changes Requested",
      `${name} ${actionLabel} on the ${dest} quote${message ? `: "${message}"` : ""}`,
      undefined,
      actionType === "accepted" ? "quote_accepted" : "quote_changes_requested",
    );

    return action;
  },

  /**
   * Notify the owning agent that a client opened a quote in the portal. The
   * message names the client and the quote; the link opens the quote in place
   * on the client page.
   */
  async notifyPortalView(_token: string, quoteId: string, viewerClientId: string | null, viewerName: string | null) {
    // Best-effort: a notification failure must never fail the view request.
    try {
      const info = await quotePublicRepository.findNotifyInfo(quoteId);
      const ownerClientId = info?.clientId ?? null;
      const label = info?.title || info?.destinationName || "";
      const isOwner = !ownerClientId || ownerClientId === viewerClientId;
      const who = viewerName || "A client";
      const quotePhrase = label ? `${label} quote` : "quote";
      const message = isOwner
        ? `${who} viewed their ${quotePhrase} via the portal`
        : `${who} viewed the ${quotePhrase} via the portal`;
      await quotePublicRepository.notifyAgent(
        quoteId,
        "Quote Viewed",
        message,
        ownerClientId ? `/clients/${ownerClientId}?holiday=quote:${quoteId}` : `/quotes/${quoteId}`,
        "quote_viewed",
      );
    } catch (err) {
      console.error("Portal view notification failed:", err);
    }
  },

  async logShare(token: string, method: string) {
    const quoteId = await quotePublicRepository.findQuoteIdByToken(token);
    if (!quoteId) throw new AppError("Quote not found", 404);

    const quoteData = await quotePublicRepository.findByToken(token);
    const dest = quoteData?.destinationName || "their holiday";
    const name = quoteData?.clientName || "A customer";

    await quotePublicRepository.notifyAgent(
      quoteId,
      "Quote Shared!",
      `${name} shared their ${dest} quote via ${method}`,
      undefined,
      "quote_shared",
    );
  },
};

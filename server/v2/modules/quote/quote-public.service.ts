import { quotePublicRepository } from "./quote-public.repository";
import { AppError } from "../../utils/error-handler";
import { customerPrice } from "../../utils/customer-price";
import type { InsertQuoteView } from "@shared/schema";

type NotifyInfo = { title: string | null; destinationName: string | null; clientId: string | null; clientName: string | null };

/** Label + link shared by the portal and shared-link view notifications. */
function describeNotifyTarget(quoteId: string, info: NotifyInfo | null) {
  const ownerClientId = info?.clientId ?? null;
  const label = info?.title || info?.destinationName || "";
  return {
    ownerClientId,
    label,
    quotePhrase: label ? `${label} quote` : "quote",
    link: ownerClientId ? `/clients/${ownerClientId}?holiday=quote:${quoteId}` : `/quotes/${quoteId}`,
  };
}

export const quotePublicService = {
  async getQuoteByToken(token: string) {
    const data = await quotePublicRepository.findByToken(token);
    if (!data) throw new AppError("Quote not found", 404);
    // The customer-facing price is the calculated total (sales − discount + service charge),
    // with the per-person figure derived from that same total.
    // Total includes extras not in the package; the per-person figure is the holiday price only.
    const price = customerPrice({ ...data, adults: data.adults, children: data.children });
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

    await this.notifyLinkView(quoteId, viewData);
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
      const { ownerClientId, quotePhrase, link } = describeNotifyTarget(quoteId, info);
      const isOwner = !ownerClientId || ownerClientId === viewerClientId;
      const who = viewerName || "A client";
      const message = isOwner
        ? `${who} viewed their ${quotePhrase} via the portal`
        : `${who} viewed the ${quotePhrase} via the portal`;
      await quotePublicRepository.notifyAgent(quoteId, "Quote Viewed", message, link, "quote_viewed");
    } catch (err) {
      console.error("Portal view notification failed:", err);
    }
  },

  /**
   * Notify the owning agent that someone opened the quote through the shared
   * public link. Best-effort: never throws.
   */
  async notifyLinkView(quoteId: string, viewData: Omit<InsertQuoteView, "quoteId">) {
    try {
      const info = await quotePublicRepository.findNotifyInfo(quoteId);
      const { label, quotePhrase, link } = describeNotifyTarget(quoteId, info);
      const clientName = info?.clientName?.trim() || "";
      const subject = clientName
        ? `${clientName}'s ${quotePhrase}`
        : label
          ? `The ${quotePhrase}`
          : "A quote";
      const device = viewData.deviceType ? ` (${viewData.deviceType})` : "";
      await quotePublicRepository.notifyAgent(
        quoteId,
        "Quote Viewed",
        `${subject} was opened via the shared link${device}`,
        link,
        "quote_viewed",
      );
    } catch (err) {
      console.error("Shared link view notification failed:", err);
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

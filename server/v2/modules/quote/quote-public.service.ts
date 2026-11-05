import { quotePublicRepository } from "./quote-public.repository";
import { AppError } from "../../utils/error-handler";
import { customerPrice } from "../../utils/customer-price";
import type { InsertQuoteView } from "@shared/schema";

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

    // Public (non-portal) views are still counted for analytics, but we no
    // longer notify the agent — only portal views create a "Quote Viewed" note.
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
    );

    return action;
  },

  async logShare(token: string, method: string) {
    const quoteId = await quotePublicRepository.findQuoteIdByToken(token);
    if (!quoteId) throw new AppError("Quote not found", 404);

    const quoteData = await quotePublicRepository.findByToken(token);
    const dest = quoteData?.destinationName || "their holiday";

    await quotePublicRepository.notifyAgent(
      quoteId,
      "Quote Shared!",
      `A customer shared their ${dest} quote via ${method}`,
    );
  },
};

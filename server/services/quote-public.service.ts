import { quotePublicRepository } from "../repositories/quote-public.repository";
import { noteService } from "./note.service";
import { AppError } from "../utils/error-handler";
import type { InsertQuoteView } from "@shared/schema";

export const quotePublicService = {
  async getQuoteByToken(token: string) {
    const data = await quotePublicRepository.findByToken(token);
    if (!data) throw new AppError("Quote not found", 404);
    return data;
  },

  async logView(token: string, viewData: Omit<InsertQuoteView, "quoteId">, timezone?: string) {
    const quoteId = await quotePublicRepository.findQuoteIdByToken(token);
    if (!quoteId) throw new AppError("Quote not found", 404);

    const view = await quotePublicRepository.logView(quoteId, viewData);

    const quoteData = await quotePublicRepository.findByToken(token);
    const dest = quoteData?.destinationName || "their holiday";

    await quotePublicRepository.notifyAgent(
      quoteId,
      "Quote Viewed",
      `A customer just viewed their quote for ${dest}`,
    );

    const transactionId = quoteData?.transactionId;
    if (transactionId) {
      const clientName = quoteData?.clientName || "Client";
      const userId = quoteData?.agentUserId || null;

      const now = new Date();
      let tz = "UTC";
      if (timezone) {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: timezone });
          tz = timezone;
        } catch {
          // invalid timezone, fall back to UTC
        }
      }
      const timeStr = now
        .toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: tz })
        .toLowerCase();
      const when = `at ${timeStr} today`;

      await noteService.createNote({
        description: "system",
        content: `${clientName} viewed this quote ${when}`,
        transaction_id: transactionId,
        user_id: userId,
        agent_id: null,
      });
    }

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

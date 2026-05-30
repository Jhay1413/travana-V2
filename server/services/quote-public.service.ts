import { quotePublicRepository } from "../repositories/quote-public.repository";
import { noteRepository } from "../repositories/note.repository";
import { AppError } from "../utils/error-handler";
import type { InsertQuoteView } from "@shared/schema";

export const quotePublicService = {
  async getQuoteByToken(token: string) {
    const data = await quotePublicRepository.findByToken(token);
    if (!data) throw new AppError("Quote not found", 404);
    return data;
  },

  async logView(token: string, viewData: Omit<InsertQuoteView, "quoteId">) {
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

    const txnInfo = await quotePublicRepository.getTransactionAndAgentByQuoteId(quoteId);
    if (txnInfo) {
      const viewer = viewData.viewerName?.trim();
      const device = viewData.deviceType ? ` from ${viewData.deviceType}` : "";
      const who = viewer ? viewer : "Someone";
      await noteRepository.create({
        transaction_id: txnInfo.transactionId,
        agent_id: txnInfo.agentUserId,
        content: `${who} viewed the ${dest} quote${device}.`,
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

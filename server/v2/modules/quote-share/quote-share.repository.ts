import { quotePublicRepository } from '../quote/quote-public.repository';

export const quoteShareRepository = {
  getAgentUserIdByQuoteId: (quoteId: string) =>
    quotePublicRepository.getAgentUserIdByQuoteId(quoteId),

  setToken: (quoteId: string) =>
    quotePublicRepository.setToken(quoteId),

  getViewStats: (quoteId: string) =>
    quotePublicRepository.getViewStats(quoteId),

  getCustomerActions: (quoteId: string) =>
    quotePublicRepository.getCustomerActions(quoteId),

  updateSentInfo: (quoteId: string, sentVia: string) =>
    quotePublicRepository.updateSentInfo(quoteId, sentVia),
};

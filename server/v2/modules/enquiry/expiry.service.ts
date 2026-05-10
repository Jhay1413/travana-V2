import { enquiryTableRepository } from "./enquiry.repository";
import { newQuoteRepository } from "../quote/quote.repository";

export async function expireStaleEnquiriesAndQuotes(): Promise<void> {
  const [expiredEnquiries, expiredQuotes] = await Promise.all([
    enquiryTableRepository.markStaleAsExpired(),
    newQuoteRepository.markStaleAsExpired(),
  ]);

  const [activatedEnquiries, activatedQuotes] = await Promise.all([
    enquiryTableRepository.activateDueFutureDeals(),
    newQuoteRepository.activateDueFutureDeals(),
  ]);

  console.log(
    `[Expiry] Marked ${expiredEnquiries.length} enquiries and ${expiredQuotes.length} quotes as expired.`,
  );
  console.log(
    `[Expiry] Activated ${activatedEnquiries.length} enquiries and ${activatedQuotes.length} quotes from future deal.`,
  );
}

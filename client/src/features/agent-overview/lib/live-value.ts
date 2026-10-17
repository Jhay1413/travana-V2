import type { Transaction } from "@/features/quote/types";
import {
  formatCurrency,
  getEnquiryBudget,
  getTransactionValue,
  hasQuoteOrBooking,
} from "@/features/pipeline";

export type LiveTab = "enquiry" | "quotes" | "bookings";

/**
 * Right-hand money label of a Pipeline Live row, using the same stage-aware helpers
 * as /pipeline. Enquiries show their budget ("Budget £2,000"); a quote or booking
 * shows its value, including "£0"; a deal with nothing to show returns null.
 */
export function liveValueLabel(t: Transaction, tab: LiveTab): string | null {
  if (tab === "enquiry") {
    const budget = getEnquiryBudget(t);
    return budget && budget > 0 ? `Budget ${formatCurrency(budget)}` : null;
  }
  if (!hasQuoteOrBooking(t)) return null;
  return formatCurrency(getTransactionValue(t));
}

/** Row title for the active tab: that tab's entity first, then quote, booking, enquiry, then a short id. */
export function liveTitle(t: Transaction, tab: LiveTab): string {
  const byTab = tab === "enquiry" ? t.enquiry?.title : tab === "quotes" ? t.quotes?.[0]?.title : t.booking?.title;
  return byTab || t.quotes?.[0]?.title || t.booking?.title || t.enquiry?.title || `#${t.id.slice(0, 8)}`;
}

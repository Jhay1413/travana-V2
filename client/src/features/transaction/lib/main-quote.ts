import type { Quote, Transaction } from "@/features/quote/types";

// A transaction can carry several quotes (copies/variants). The "main" one is
// the non-copy quote, falling back to the first quote when every quote under
// the transaction is a copy (or there's only ever been one). This exact
// expression was duplicated at the pipeline live panel and the tickets
// feature before being pulled out here.
export function mainQuoteOf(transaction: Pick<Transaction, "quotes">): Quote | undefined {
  return transaction.quotes?.find((q) => !q.isQuoteCopy) ?? transaction.quotes?.[0];
}

export type HolidayKind = "booking" | "quote" | "enquiry" | null;

export interface HolidayLabel {
  kind: HolidayKind;
  title: string;
  date: string | null;
}

// Which holiday a transaction is best represented by, for anywhere a
// transaction needs a single title/date to link to or display. Decided by
// `transaction.status` first, falling back to whichever relation is actually
// present when the status is missing (or doesn't match a known relation).
export function holidayLabelOf(transaction: Transaction): HolidayLabel {
  let kind: HolidayKind = null;
  if (transaction.status === "on_booking") kind = "booking";
  else if (transaction.status === "on_quote") kind = "quote";
  else if (transaction.status === "on_enquiry") kind = "enquiry";
  else if (transaction.booking) kind = "booking";
  else if (transaction.quotes?.length) kind = "quote";
  else if (transaction.enquiry) kind = "enquiry";

  if (kind === "booking" && transaction.booking) {
    return { kind, title: transaction.booking.title || "Untitled booking", date: transaction.booking.travel_date ?? null };
  }
  if (kind === "quote") {
    const quote = mainQuoteOf(transaction);
    if (quote) return { kind, title: quote.title || "Untitled quote", date: quote.travel_date ?? null };
  }
  if (kind === "enquiry" && transaction.enquiry) {
    return { kind, title: transaction.enquiry.title || "Untitled enquiry", date: transaction.enquiry.travel_date ?? null };
  }

  return { kind: null, title: "Untitled", date: null };
}

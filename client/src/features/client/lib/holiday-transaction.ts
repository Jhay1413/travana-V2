import type { HolidaySelection } from "@/features/client/types";

interface TransactionLike {
  id: string;
  enquiry?: { id: string } | null;
  quotes?: Array<{ id: string }>;
  booking?: { id: string } | null;
}

/**
 * The transaction (deal) a selected holiday belongs to. HolidaySelection.id is
 * the enquiry / quote / booking id, so it is looked up across the client's
 * transactions. Null when nothing is selected or the id is not found.
 */
export function resolveSelectionTransactionId(
  selection: HolidaySelection | null,
  transactions: readonly TransactionLike[],
): string | null {
  if (!selection) return null;
  for (const t of transactions) {
    if (selection.type === "enquiry" && t.enquiry?.id === selection.id) return t.id;
    if (selection.type === "quote" && t.quotes?.some((q) => q.id === selection.id)) return t.id;
    if (selection.type === "booking" && t.booking?.id === selection.id) return t.id;
  }
  return null;
}

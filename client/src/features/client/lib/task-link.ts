// Pure helpers for linking a task to a client's deal from places that don't
// already know the deal (the dashboard "New task", the "+" menu's Task).
import type { EnquiryTable, Quote, Transaction } from "@/features/quote/types";
import type { HolidayBooking } from "@/features/client/types";
import { buildBookingRows, buildEnquiryRows, buildQuoteRows, groupDealRows, type HolidayRowData } from "./live-deal-rows";

export type TaskDealType = "enquiry" | "quote" | "booking";

export interface TaskDealOption {
  type: TaskDealType;
  id: string;
  title: string;
  /** Destination and dates, when known. */
  detail: string | null;
}

export const DEAL_GROUP_LABELS: Record<TaskDealType, string> = { quote: "Quotes", booking: "Bookings", enquiry: "Enquiries" };
/** Display order of the groups in the deal picker. */
export const DEAL_GROUP_ORDER: TaskDealType[] = ["quote", "booking", "enquiry"];

/** Stable select value for a deal option. */
export const dealKey = (d: Pick<TaskDealOption, "type" | "id">): string => `${d.type}:${d.id}`;

function toOption(row: HolidayRowData, type: TaskDealType): TaskDealOption {
  return {
    type,
    id: row.id,
    title: row.title,
    detail: [row.destinationName, row.dateLine].filter(Boolean).join(" · ") || null,
  };
}

/**
 * The client's live deals as picker options: quotes (with their copies), then
 * bookings, then enquiries. Expired and lost deals are left out, as decided for
 * the dashboard task form. Quotes already converted to a booking appear once, as
 * the booking.
 */
export function liveDealOptions(transactions: Transaction[]): TaskDealOption[] {
  const quotes: Quote[] = transactions.flatMap((t) => t.quotes ?? []);
  const enquiries = transactions.map((t) => t.enquiry).filter((e): e is EnquiryTable => !!e);
  const bookings: HolidayBooking[] = transactions.flatMap((t) => (t.booking ? [{ ...t.booking, user_id: t.user_id }] : []));
  const bookedTransactionIds = new Set(bookings.map((b) => b.transaction_id));

  const quoteRows = groupDealRows(buildQuoteRows(quotes, bookedTransactionIds)).active.flatMap((row) => [
    row,
    ...row.copies.filter((c) => !c.expired && !c.lost),
  ]);
  const bookingRows = groupDealRows(buildBookingRows(bookings, { markLostBookings: true })).active;
  const enquiryRows = groupDealRows(buildEnquiryRows(enquiries)).active;

  return [
    ...quoteRows.map((r) => toOption(r, "quote")),
    ...bookingRows.map((r) => toOption(r, "booking")),
    ...enquiryRows.map((r) => toOption(r, "enquiry")),
  ];
}

/**
 * The task entity for a picked deal. Booking tasks are stored under the "quote"
 * entity type with the booking id, which is how the booking page lists them
 * (see HolidayTasksTab); linking from elsewhere must match or the task would not
 * show there.
 */
export function taskEntityForDeal(deal: Pick<TaskDealOption, "type" | "id">): { entityType: string; entityId: string } {
  return { entityType: deal.type === "booking" ? "quote" : deal.type, entityId: deal.id };
}

export interface TaskLinkChoice {
  /** Entity supplied by the page that opened the form (a deal or client page). */
  entityType?: string | null;
  entityId?: string | null;
  deal: Pick<TaskDealOption, "type" | "id"> | null;
  clientId: string | null;
}

/** What a new task is attached to: the caller's entity wins, then the picked deal, then the picked client, else nothing. */
export function linkedTaskEntity({ entityType, entityId, deal, clientId }: TaskLinkChoice): { entityType: string; entityId: string } | Record<string, never> {
  if (entityType && entityId) return { entityType, entityId };
  if (deal) return taskEntityForDeal(deal);
  if (clientId) return { entityType: "client", entityId: clientId };
  return {};
}

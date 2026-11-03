export type {
  Ticket,
  InsertTicket,
  TicketAttachment,
  InsertTicketAttachment,
  TicketReply,
  InsertTicketReply,
} from '@shared/schema';

import type { Ticket, TicketReply, InsertTicket } from '@shared/schema';

export type TicketReplyWithLikes = TicketReply & {
  likeCount: number;
  likedByMe: boolean;
};

/** A ticket joined with display names and like state, for list/detail endpoints. */
export type TicketWithLikes = Ticket & {
  clientName: string | null;
  clientPhone: string | null;
  userName: string | null;
  assignedToName: string | null;
  replyCount: number;
  likeCount: number;
  likedByMe: boolean;
  /** Latest of: created, last edit, newest reply. */
  lastActivityAt: Date;
};

export type TicketHolidayKind = 'booking' | 'quote' | 'enquiry';

/** Compact summary of the holiday (transaction) a ticket is linked to. */
export interface TicketHolidaySummary {
  transactionId: string;
  kind: TicketHolidayKind | null;
  title: string | null;
  travelDate: string | null;
  nights: number | null;
  operatorName: string | null;
  operatorLogoUrl: string | null;
  haysRef: string | null;
  supplierRef: string | null;
}

/** GET /tickets row: a ticket plus its linked-holiday summary. */
export type TicketListItem = TicketWithLikes & { holiday: TicketHolidaySummary | null };

/** Just enough of a ticket to gate replies / attachments by the ticket's scope. */
export type TicketScopeRef = Pick<
  Ticket,
  'id' | 'userId' | 'assignedTo' | 'orgId' | 'branchId' | 'subject' | 'status' | 'resolvedAt' | 'clientId' | 'transactionId'
>;

/** Values the service may write: the insert shape plus the server-owned resolvedAt. */
export type TicketWriteValues = Partial<InsertTicket> & { resolvedAt?: Date | null };

export type HolidayTransactionStatus = 'on_enquiry' | 'on_quote' | 'on_booking';

/** Transaction row (with its booking / enquiry facets) used to build a holiday summary. */
export interface HolidayTransactionRow {
  transactionId: string;
  orgId: string | null;
  clientId: string | null;
  status: HolidayTransactionStatus | null;
  bookingId: string | null;
  bookingTitle: string | null;
  bookingTravelDate: string | null;
  bookingNights: number | null;
  haysRef: string | null;
  supplierRef: string | null;
  bookingOperatorName: string | null;
  bookingOperatorLogoUrl: string | null;
  enquiryId: string | null;
  enquiryTitle: string | null;
  enquiryTravelDate: string | null;
  enquiryNights: number | null;
}

/** Latest primary quote of a transaction. */
export interface HolidayQuoteRow {
  transactionId: string;
  quoteId: string;
  title: string | null;
  travelDate: string | null;
  nights: number | null;
  operatorName: string | null;
  operatorLogoUrl: string | null;
}

/** Minimal transaction facts for validating a ticket -> holiday link. */
export interface HolidayLinkTarget {
  id: string;
  orgId: string | null;
  clientId: string | null;
}

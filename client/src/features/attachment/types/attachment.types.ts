export interface TicketAttachment {
  id: string;
  ticketId: string;
  /** The reply this attachment was posted with, or null for a ticket-level attachment. */
  replyId: string | null;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

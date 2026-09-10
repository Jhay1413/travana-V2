/** A reply row as stored — what create / update return. */
export interface TicketReplyRow {
  id: string;
  ticketId: string;
  userId: string;
  parentReplyId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string | null;
}

/** A reply as listed for a ticket, hydrated with like state for the viewer. */
export interface TicketReply extends TicketReplyRow {
  likeCount: number;
  likedByMe: boolean;
}

export interface CreateReplyData {
  /** Kept for callers that still pass it; the server takes the author from the session. */
  userId: string;
  content: string;
  parentReplyId?: string;
}

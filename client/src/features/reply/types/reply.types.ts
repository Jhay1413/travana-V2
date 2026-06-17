export interface TicketReply {
  id: string;
  ticketId: string;
  userId: string;
  parentReplyId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateReplyData {
  userId: string;
  content: string;
  parentReplyId?: string;
}

export type {
  Ticket,
  InsertTicket,
  TicketAttachment,
  InsertTicketAttachment,
  TicketReply,
  InsertTicketReply,
} from '@shared/schema';

import type { Ticket, TicketReply } from '@shared/schema';

export type TicketReplyWithLikes = TicketReply & {
  likeCount: number;
  likedByMe: boolean;
};

/** A ticket joined with display names and like state, for list/detail endpoints. */
export type TicketWithLikes = Ticket & {
  clientName: string | null;
  userName: string | null;
  assignedToName: string | null;
  replyCount: number;
  likeCount: number;
  likedByMe: boolean;
};

/** A reply joined to the org of its ticket, for scope checks. */
export type TicketReplyWithOrg = TicketReply & {
  ticketOrgId: string | null;
};

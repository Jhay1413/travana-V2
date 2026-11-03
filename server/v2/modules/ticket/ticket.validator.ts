import { z } from 'zod';
import { insertTicketSchema } from '@shared/schema';

export const createTicketValidator = z.object({
  body: insertTicketSchema,
});

// Shared with the controller (via ticketListModeSchema.parse) so the query
// param is narrowed through the schema rather than an `as` cast.
export const ticketListModeSchema = z.enum(["mine", "raised", "all"]).optional().default("mine");
export type TicketListModeQuery = z.infer<typeof ticketListModeSchema>;

/** GET /tickets — `scope` picks the slice of the caller's tickets returned;
 *  "all" is further gated server-side to admin-tier roles (see ticket.service.ts). */
export const listTicketsValidator = z.object({
  query: z.object({ scope: ticketListModeSchema }),
});

export const updateTicketValidator = z.object({
  params: z.object({ id: z.string() }),
  body: insertTicketSchema.partial(),
});

/** Routes that only take a ticket id (like). */
export const ticketIdValidator = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const createTicketReplyValidator = z.object({
  params: z.object({ ticketId: z.string() }),
  body: z.object({
    content: z.string().min(1, 'Content is required'),
    parentReplyId: z.string().nullable().optional(),
  }),
});

export const updateTicketReplyValidator = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    content: z.string().min(1, 'Content is required'),
  }),
});

/** Routes that only take a reply id (like, delete). */
export const ticketReplyIdValidator = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export type CreateTicketReplyBody = z.infer<typeof createTicketReplyValidator>['body'];
export type UpdateTicketReplyBody = z.infer<typeof updateTicketReplyValidator>['body'];

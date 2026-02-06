import { z } from "zod";
import { insertTicketSchema, insertTicketReplySchema } from "@shared/schema";

export const createTicketValidator = z.object({
  body: insertTicketSchema,
});

export const updateTicketValidator = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: insertTicketSchema.partial(),
});

export const createTicketReplyValidator = z.object({
  params: z.object({
    ticketId: z.string(),
  }),
  body: insertTicketReplySchema.omit({ ticketId: true }),
});

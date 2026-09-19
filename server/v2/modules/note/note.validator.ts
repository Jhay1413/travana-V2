import { z } from "zod";
import { insertNoteSchema } from "@shared/schema";

export const createNoteValidator = z.object({
  body: insertNoteSchema,
});

export const updateNoteValidator = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({ content: z.string() }),
});

export const listByClientValidator = z.object({
  params: z.object({
    // client_table.id is a uuid column — reject malformed ids as a 400 here
    // instead of letting them reach Postgres as a 22P02 (→ 500).
    clientId: z.string().uuid(),
  }),
  query: z.object({
    // Opt-in flag: when "true", the customer's deal (transaction) notes are
    // merged into the client-level list. Left off, behaviour is unchanged.
    includeDeals: z.enum(["true", "false"]).optional(),
  }),
});

import { z } from "zod";

// notes.id is a uuid column — reject malformed ids as a 400 here instead of
// letting them reach Postgres as a 22P02 (-> 500).
export const listByNoteValidator = z.object({
  params: z.object({ noteId: z.string().uuid() }),
});

export const listByTransactionValidator = z.object({
  params: z.object({ transactionId: z.string().uuid() }),
});

export const uploadToNoteValidator = z.object({
  params: z.object({ noteId: z.string().uuid() }),
});

// note_attachments.id is a varchar (gen_random_uuid()), so any non-empty string is fine.
export const attachmentIdValidator = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({
    inline: z.enum(["1", "0"]).optional(),
    disposition: z.enum(["inline", "attachment"]).optional(),
  }),
});

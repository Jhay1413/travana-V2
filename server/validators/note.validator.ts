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

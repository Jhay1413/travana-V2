import { z } from "zod";
import { insertEnquiryNoteSchema } from "@shared/schema";

export const createEnquiryNoteValidator = z.object({
  body: insertEnquiryNoteSchema,
});

export const updateEnquiryNoteValidator = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({ content: z.string() }),
});

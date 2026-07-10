import { z } from "zod";

export const fromConversationValidator = z.object({
  body: z.object({
    transcript: z.string().trim().min(1, "Conversation transcript is required"),
  }),
});

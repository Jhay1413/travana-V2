import { z } from "zod";

const chatModeEnum = z.enum(["assistant", "test_flow"]);

export const createSessionValidator = z.object({
  body: z.object({ mode: chatModeEnum }),
});

// SendSeven conversation ids are opaque strings (not necessarily UUIDs) —
// only require non-empty.
export const forkSessionValidator = z.object({
  body: z.object({ conversationId: z.string().trim().min(1, "conversationId is required") }),
});

export const postMessageValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ text: z.string().trim().min(1, "Message text is required") }),
});

export const listMessagesValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
});

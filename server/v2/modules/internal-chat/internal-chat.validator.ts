import { z } from "zod";

const chatModeEnum = z.enum(["assistant", "test_flow"]);

export const createSessionValidator = z.object({
  body: z.object({ mode: chatModeEnum }),
});

export const postMessageValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ text: z.string().trim().min(1, "Message text is required") }),
});

export const listMessagesValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
});

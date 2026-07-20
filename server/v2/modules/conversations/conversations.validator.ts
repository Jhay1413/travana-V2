import { z } from "zod";

// SendSeven conversation ids are opaque provider strings (not necessarily
// UUIDs), so this only guards against an empty/missing param.
export const conversationIdParamValidator = z.object({
  params: z.object({ conversation_id: z.string().min(1, "conversation_id is required") }),
});

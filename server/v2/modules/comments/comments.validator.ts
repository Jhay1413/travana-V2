import { z } from "zod";
import { PRIVATE_REPLY_MAX_LENGTH } from "./comments.types";

// Agents may only move a comment between these three states by hand. `replied`
// and `auto_replied` are set by the platform when a private reply actually goes
// out; accepting them here would let the UI claim a DM was sent when none was.
export const triageCommentValidator = z.object({
  params: z.object({
    commentId: z.string().trim().min(1, "Comment id is required"),
  }),
  body: z.object({
    state: z.enum(["handled", "ignored", "pending"], {
      errorMap: () => ({ message: "state must be one of: handled, ignored, pending" }),
    }),
  }),
});

export const privateReplyValidator = z.object({
  params: z.object({
    commentId: z.string().trim().min(1, "Comment id is required"),
  }),
  body: z.object({
    text: z
      .string()
      .trim()
      .min(1, "Reply text is required")
      .max(PRIVATE_REPLY_MAX_LENGTH, `Reply text must be ${PRIVATE_REPLY_MAX_LENGTH} characters or fewer`),
    // Optional here: the service falls back to the comment's own channel, and
    // upstream only requires it when the comment isn't stored in the workspace.
    channel_id: z.string().trim().min(1).optional(),
  }),
});

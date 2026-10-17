import { z } from "zod";

// SendSeven conversation ids are opaque provider strings (not necessarily
// UUIDs), so this only guards against an empty/missing param.
export const conversationIdParamValidator = z.object({
  params: z.object({ conversation_id: z.string().min(1, "conversation_id is required") }),
});

export const REPLY_TONES = ["friendly", "professional", "short"] as const;

// Body is optional: an empty/missing body keeps the original single-draft behaviour.
export const aiSuggestReplyValidator = z.object({
  params: conversationIdParamValidator.shape.params,
  body: z
    .object({
      tone: z.enum(REPLY_TONES).optional(),
      count: z.number().int().min(1).max(3).optional(),
    })
    .optional()
    .default({}),
});

const queryBool = z.union([z.boolean(), z.enum(["true", "false"])]);

// The controller passes `status` through to the provider untouched (any string),
// so it is only length-bounded here; unknown keys are allowed through.
// The client sends snake_case keys and the controller reads both spellings, so
// both are declared with identical rules. NOTE: validate() does not write the
// parsed value back to req.query, so coercion here is validation-only; the
// controller still parses the raw strings itself.
export const listConversationsQueryValidator = z.object({
  query: z
    .object({
      page: z.coerce.number().int().positive().optional(),
      pageSize: z.coerce.number().int().positive().max(100).optional(),
      page_size: z.coerce.number().int().positive().max(100).optional(),
      status: z.string().max(64).optional(),
      assignedTo: z.string().max(64).optional(),
      assigned_to: z.string().max(64).optional(),
      needsReply: queryBool.optional(),
      needs_reply: queryBool.optional(),
      search: z.string().max(200).optional(),
      inboxId: z.string().optional(),
      inbox_id: z.string().optional(),
      filter: z.string().optional(),
      contactId: z.string().optional(),
      contact_id: z.string().optional(),
    })
    .passthrough(),
});

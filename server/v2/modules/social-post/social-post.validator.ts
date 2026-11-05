import { z } from "zod";
import { IMAGE_ORDER_TOKEN } from "./media-order";

/** `imageOrder` arrives as a JSON string inside the multipart body. */
export const imageOrderField = z
  .string()
  .optional()
  .refine(
    (raw) => {
      if (raw === undefined || raw.trim() === "") return true;
      try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.every((t) => typeof t === "string" && IMAGE_ORDER_TOKEN.test(t));
      } catch {
        return false;
      }
    },
    { message: "imageOrder must be a JSON array of existing:<id>, url:<n> or file:<n> entries" },
  );

/** Parses the multipart `accountIds` JSON string; undefined when absent. Assumes the validator already passed. */
export function parseAccountIdsField(raw: unknown): number[] | undefined {
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : undefined;
  } catch {
    return undefined;
  }
}

/** `accountIds` arrives as a JSON string inside the multipart body: at least one positive integer id. */
export const accountIdsField = z
  .string()
  .optional()
  .refine(
    (raw) => {
      if (raw === undefined || raw.trim() === "") return true;
      try {
        const parsed: unknown = JSON.parse(raw);
        return (
          Array.isArray(parsed) &&
          parsed.length >= 1 &&
          parsed.length <= 20 &&
          parsed.every((n) => typeof n === "number" && Number.isInteger(n) && n > 0)
        );
      } catch {
        return false;
      }
    },
    { message: "Choose at least one account to post to" },
  );

// Only `imageOrder` and `accountIds` is checked here; the controller still reads the other multipart fields itself.
const scheduleBody = z.object({ imageOrder: imageOrderField, accountIds: accountIdsField }).passthrough();

export const scheduleMediaSchema = z.object({ body: scheduleBody });

/** PATCH /social-posts/:id: only the post text and the chosen accounts may change; unknown keys are refused. */
export const updateSocialPostSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      post: z.string().max(20000).optional(),
      accountIds: z.array(z.number().int().positive()).min(1).max(20).optional(),
    })
    .strict(),
});

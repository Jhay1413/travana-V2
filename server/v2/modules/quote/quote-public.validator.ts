import { z } from "zod";
import { PUBLIC_SHARE_METHODS } from "./quote-public.types";

/** POST /:token/share: the method must be one of the fixed share buttons. */
export const shareQuoteSchema = z.object({
  params: z.object({ token: z.string().min(1).max(64) }),
  body: z.object({ method: z.enum(PUBLIC_SHARE_METHODS) }).strict(),
});

import { z } from "zod";

export const QUOTE_SENT_VIA = ["link", "sms", "email", "whatsapp"] as const;
export type QuoteSentVia = (typeof QUOTE_SENT_VIA)[number];

// PATCH /:id/sent — records that the quote was shared and how.
export const markSentValidator = z.object({
  params: z.object({ id: z.string().uuid("Invalid quote id") }),
  body: z
    .object({
      sentVia: z.enum(QUOTE_SENT_VIA, {
        errorMap: () => ({ message: `sentVia must be one of: ${QUOTE_SENT_VIA.join(", ")}` }),
      }),
    })
    .strict(),
});

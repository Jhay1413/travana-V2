import { z } from "zod";
import { quoteTemplateSettingsBody } from "../whatsapp-templates/whatsapp-settings.validator";

export const QUOTE_SENT_VIA = ["link", "sms", "email", "whatsapp"] as const;
export type QuoteSentVia = (typeof QUOTE_SENT_VIA)[number];

// POST /:id/send-whatsapp — sends the quote link to the client's WhatsApp via SendSeven.
export const sendWhatsappValidator = z.object({
  params: z.object({ id: z.string().uuid("Invalid quote id") }),
  body: z.object({ clientId: z.string().uuid("Invalid client id") }).strict(),
});

// GET/PUT /whatsapp-template-settings — per-org template used when the 24h window is closed.
export const saveWhatsappTemplateSettingsValidator = z.object({ body: quoteTemplateSettingsBody });

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

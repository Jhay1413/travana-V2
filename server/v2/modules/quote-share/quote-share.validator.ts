import { z } from "zod";

export const QUOTE_SENT_VIA = ["link", "sms", "email", "whatsapp"] as const;
export type QuoteSentVia = (typeof QUOTE_SENT_VIA)[number];

// POST /:id/send-whatsapp — sends the quote link to the client's WhatsApp via SendSeven.
export const sendWhatsappValidator = z.object({
  params: z.object({ id: z.string().uuid("Invalid quote id") }),
  body: z.object({ clientId: z.string().uuid("Invalid client id") }).strict(),
});

// GET/PUT /whatsapp-template-settings — per-org template used when the 24h window is closed.
const TEMPLATE_VARIABLE_SOURCES = ["client_first_name", "agent_name", "agency_name", "quote_link", "custom"] as const;

const templateVariableSchema = z
  .object({
    source: z.enum(TEMPLATE_VARIABLE_SOURCES),
    text: z.string().min(1).max(200).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.source === "custom" && !(v.text && v.text.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["text"], message: "Custom variables need text" });
    }
  });

export const saveWhatsappTemplateSettingsValidator = z.object({
  body: z
    .object({
      templateName: z.string().min(1).max(512).regex(/^[a-z0-9_]+$/, "Template name may only contain a-z, 0-9 and _").nullable(),
      templateLanguage: z.string().min(2).max(10).nullable(),
      channelId: z.string().min(1).nullable(),
      variables: z.record(z.string().regex(/^\d+$/, "Variable keys must be placeholder numbers"), templateVariableSchema),
    })
    .strict(),
});

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

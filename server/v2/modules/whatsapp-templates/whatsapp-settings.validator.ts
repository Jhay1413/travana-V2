import { z } from "zod";
import type { WhatsappTemplateVariableSource } from "@shared/schema";

// Body schema shared by the quote and general-update template settings routes.
// Each kind says which placeholder sources it allows; the update kind also
// requires exactly one placeholder to carry the agent's message.

export const QUOTE_TEMPLATE_SOURCES = ["client_first_name", "agent_name", "agency_name", "quote_link", "custom"] as const satisfies readonly WhatsappTemplateVariableSource[];
export const UPDATE_TEMPLATE_SOURCES = ["client_first_name", "agent_name", "agency_name", "message", "custom"] as const satisfies readonly WhatsappTemplateVariableSource[];

interface TemplateSettingsOptions {
  allowedSources: readonly [WhatsappTemplateVariableSource, ...WhatsappTemplateVariableSource[]];
  requireOneMessage: boolean;
}

export function templateSettingsSchema({ allowedSources, requireOneMessage }: TemplateSettingsOptions) {
  const variable = z
    .object({
      source: z.enum(allowedSources),
      text: z.string().min(1).max(200).optional(),
    })
    .strict()
    .superRefine((v, ctx) => {
      if (v.source === "custom" && !(v.text && v.text.trim())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["text"], message: "Custom variables need text" });
      }
    });

  return z
    .object({
      templateName: z.string().min(1).max(512).regex(/^[a-z0-9_]+$/, "Template name may only contain a-z, 0-9 and _").nullable(),
      templateLanguage: z.string().min(2).max(10).nullable(),
      channelId: z.string().min(1).nullable(),
      variables: z.record(z.string().regex(/^\d+$/, "Variable keys must be placeholder numbers"), variable),
    })
    .strict()
    .superRefine((body, ctx) => {
      if (!requireOneMessage || body.templateName === null) return;
      const count = Object.values(body.variables).filter((v) => v.source === "message").length;
      if (count === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["variables"], message: "One placeholder must hold the agent's message" });
      } else if (count > 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["variables"], message: "Only one placeholder can hold the agent's message" });
      }
    });
}

export const quoteTemplateSettingsBody = templateSettingsSchema({ allowedSources: QUOTE_TEMPLATE_SOURCES, requireOneMessage: false });
export const updateTemplateSettingsBody = templateSettingsSchema({ allowedSources: UPDATE_TEMPLATE_SOURCES, requireOneMessage: true });

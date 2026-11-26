import { z } from "zod";
import type { AutoMessagePurpose, WhatsappTemplateVariableSource } from "@shared/schema";
import { templateSettingsSchema } from "../whatsapp-templates/whatsapp-settings.validator";
import { AUTO_CHANNELS, AUTO_PURPOSES } from "./customer-messaging.types";

export const saveCustomerMessagingSettingsValidator = z.object({
  body: z.object({ autoChannel: z.enum(AUTO_CHANNELS) }).strict(),
});

/** There is deliberately no money source: no payment data exists to fill one. */
export const AUTO_TEMPLATE_SOURCES = [
  "client_first_name",
  "agency_name",
  "destination",
  "booking_reference",
  "departure_date",
  "portal_link",
  "balance_due_date",
  "custom",
] as const satisfies readonly WhatsappTemplateVariableSource[];

const purposeParam = z.enum(AUTO_PURPOSES);
export const purposeParamsValidator = z.object({ params: z.object({ purpose: purposeParam }) });

/** Meta numbers placeholders 1..n with no gaps; a template that declares {{1}} and {{3}} could never be sent. */
function keysAreSequential(keys: string[]): boolean {
  const nums = keys.map(Number).sort((a, b) => a - b);
  return nums.every((n, i) => n === i + 1);
}

const REQUIRED_SOURCE: Partial<Record<AutoMessagePurpose, { source: WhatsappTemplateVariableSource; message: string }>> = {
  // "Your portal is ready" with no way in would be a useless message.
  portal_ready: { source: "portal_link", message: "One placeholder must hold the portal link" },
};

const baseBody = templateSettingsSchema({ allowedSources: AUTO_TEMPLATE_SOURCES, requireOneMessage: false });

/** Body of a message type's template: the shared shape plus what this type needs. */
export function purposeTemplateBody(purpose: AutoMessagePurpose) {
  return baseBody.superRefine((body, ctx) => {
    if (body.templateName === null) return;
    if (!keysAreSequential(Object.keys(body.variables))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["variables"], message: "Placeholders must be numbered 1, 2, 3 with no gaps" });
    }
    const required = REQUIRED_SOURCE[purpose];
    if (required && !Object.values(body.variables).some((v) => v.source === required.source)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["variables"], message: required.message });
    }
  });
}

/** One request validator per message type (the body rules differ), for validate(). */
export function savePurposeTemplateValidator(purpose: AutoMessagePurpose) {
  return z.object({ body: purposeTemplateBody(purpose) });
}

/** PUT /switch/:purpose: turn a message type on or off. */
export const saveSwitchValidator = z.object({
  params: z.object({ purpose: purposeParam }),
  body: z.object({ active: z.boolean() }).strict(),
});

import { z } from "zod";

export const smsCategoryEnum = z.enum([
  "weekly_deals",
  "balance_due",
  "booking_confirmation",
  "tickets_ready",
  "portal_login",
  "custom",
]);

export const smsAutoTriggerEnum = z.enum([
  "manual",
  "on_booking_create",
  "on_pin_set",
  "on_tickets_uploaded",
  "days_before_departure",
  "weekly_schedule",
]);

export const createTemplateValidator = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    category: smsCategoryEnum.default("custom"),
    body: z.string().min(1).max(1600),
    autoTrigger: smsAutoTriggerEnum.default("manual"),
    triggerDaysBefore: z.number().int().min(0).max(365).optional().nullable(),
    triggerWeekday: z.number().int().min(0).max(6).optional().nullable(),
    triggerHour: z.number().int().min(0).max(23).optional().nullable(),
    active: z.boolean().default(true),
  }),
});

export const updateTemplateValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    category: smsCategoryEnum.optional(),
    body: z.string().min(1).max(1600).optional(),
    autoTrigger: smsAutoTriggerEnum.optional(),
    triggerDaysBefore: z.number().int().min(0).max(365).optional().nullable(),
    triggerWeekday: z.number().int().min(0).max(6).optional().nullable(),
    triggerHour: z.number().int().min(0).max(23).optional().nullable(),
    active: z.boolean().optional(),
  }),
});

export const sendSmsValidator = z.object({
  body: z.object({
    templateId: z.string().uuid().optional(),
    bodyOverride: z.string().min(1).max(1600).optional(),
    recipients: z.object({
      mode: z.enum(["client", "all_optin", "vip_tier", "badge", "list"]),
      clientId: z.string().uuid().optional(),
      clientIds: z.array(z.string().uuid()).optional(),
      vipTier: z.enum(["standard", "gold", "elite"]).optional(),
      badge: z.string().optional(),
    }),
    triggerSource: z.string().max(50).optional(),
  }),
});

export const optInValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ smsOptIn: z.boolean() }),
});

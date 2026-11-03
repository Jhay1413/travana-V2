import { z } from "zod";

export const updateSocialSettingsValidator = z.object({
  body: z.object({
    defaultViewLink: z.boolean().optional(),
    defaultPriceBadge: z.boolean().optional(),
    timeShortcuts: z
      .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time like 18:30"))
      .min(1)
      .max(8)
      .optional(),
    timezone: z.string().min(1).max(64).optional(),
  }).strict(),
});

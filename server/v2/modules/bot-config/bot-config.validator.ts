import { z } from "zod";
import { insertOrgBotConfigSchema } from "@shared/schema";

const modeEnum = z.enum(["draft", "send"]);

export const updateBotConfigValidator = z.object({
  body: insertOrgBotConfigSchema.partial().extend({
    rules: z
      .array(
        z.object({
          text: z.string().min(1).max(500),
          audience: z.enum(["general", "sales", "admin"]).default("general"),
          isActive: z.boolean().optional(),
        }),
      )
      .max(50)
      .optional(),
  }),
});

export const enableBotValidator = z.object({
  body: z.object({ mode: modeEnum.optional() }),
});

export const setModeValidator = z.object({
  body: z.object({ mode: modeEnum }),
});

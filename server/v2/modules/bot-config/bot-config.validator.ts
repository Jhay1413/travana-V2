import { z } from "zod";
import { insertOrgBotConfigSchema } from "@shared/schema";

const modeEnum = z.enum(["draft", "send"]);

export const updateBotConfigValidator = z.object({
  body: insertOrgBotConfigSchema.partial(),
});

export const enableBotValidator = z.object({
  body: z.object({ mode: modeEnum.optional() }),
});

export const setModeValidator = z.object({
  body: z.object({ mode: modeEnum }),
});

import { z } from "zod";
import { pinResetTemplateSettingsBody } from "./whatsapp-settings.validator";

export const savePinResetTemplateSettingsValidator = z.object({ body: pinResetTemplateSettingsBody });

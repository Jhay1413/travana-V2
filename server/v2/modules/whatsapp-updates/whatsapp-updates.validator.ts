import { z } from "zod";
import { MAX_UPDATE_MESSAGE_LENGTH } from "../whatsapp-templates/whatsapp-delivery.service";
import { updateTemplateSettingsBody } from "../whatsapp-templates/whatsapp-settings.validator";

const text = z.string().trim().min(1, "Write a message to send").max(MAX_UPDATE_MESSAGE_LENGTH, `Keep the message under ${MAX_UPDATE_MESSAGE_LENGTH} characters`);
const conversationId = z.string().min(1, "Invalid conversation id");

// PUT /settings — same body rules as the template settings (exactly one message placeholder).
export const saveUpdateTemplateSettingsValidator = z.object({ body: updateTemplateSettingsBody });

// GET /conversations/:conversationId/window
export const windowValidator = z.object({ params: z.object({ conversationId }) });

// POST /conversations/:conversationId/send
export const sendToConversationValidator = z.object({
  params: z.object({ conversationId }),
  body: z.object({ text }).strict(),
});

// POST /clients/:clientId/send
export const sendToClientValidator = z.object({
  params: z.object({ clientId: z.string().uuid("Invalid client id") }),
  body: z.object({ channelId: z.string().min(1, "Choose a WhatsApp channel"), text }).strict(),
});

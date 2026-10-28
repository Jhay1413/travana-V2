import { sendSevenRequest } from "../../utils/sendseven";
import type { SendTemplateRequest, SendTemplateResponse } from "./quote-share.types";

// Repository: SendSeven call for sending an approved WhatsApp template, using
// the caller's org token (resolved by the sendSevenContext middleware).

export const quoteWhatsappRepository = {
  sendTemplate(nameOrId: string, body: SendTemplateRequest): Promise<SendTemplateResponse> {
    return sendSevenRequest("POST", `/whatsapp-templates/${encodeURIComponent(nameOrId)}/send`, { body });
  },
};

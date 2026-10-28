import { isSendSevenConfigured, sendSevenRequest } from "../../utils/sendseven";
import type {
  SsCreateTemplateBody,
  SsCreateTemplateResponse,
  SsSyncResult,
  SsTemplateList,
  TemplateListQuery,
} from "./whatsapp-templates.types";

// Repository: proxies WhatsApp template operations to SendSeven using the
// caller's own org token (resolved by the sendSevenContext middleware).
export const whatsappTemplatesRepository = {
  isConfigured(): boolean {
    return isSendSevenConfigured();
  },

  list(query: TemplateListQuery): Promise<SsTemplateList> {
    return sendSevenRequest("GET", "/whatsapp-templates", { query: { channel_id: query.channel_id, status: query.status } });
  },

  sync(channelId: string): Promise<SsSyncResult> {
    return sendSevenRequest("POST", "/whatsapp-templates/sync", { query: { channel_id: channelId } });
  },

  create(body: SsCreateTemplateBody): Promise<SsCreateTemplateResponse> {
    return sendSevenRequest("POST", "/whatsapp-templates", { body });
  },

  remove(id: string): Promise<unknown> {
    return sendSevenRequest("DELETE", `/whatsapp-templates/${encodeURIComponent(id)}`, {});
  },
};

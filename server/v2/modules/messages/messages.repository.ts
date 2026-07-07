import { sendSevenRequest, useSampleData, type SsQuery } from "../../utils/sendseven";
import { sampleCreateInternalNote, sampleMessagesList, sampleSendMessage } from "./messages.fixtures";
import type { ListMessagesParams, SsMessage, SsMessageList } from "./messages.types";

// Repository: the only place that talks to the SendSeven messages API. Thin
// gateway with a fixture fallback for list/send/notes while unconfigured.

function request<T>(method: string, path: string, opts: { query?: SsQuery; body?: unknown } = {}): Promise<T> {
  return sendSevenRequest<T>(method, `/messages${path}`, opts);
}

export const messagesRepository = {
  list(params: ListMessagesParams): Promise<SsMessageList> {
    if (useSampleData()) return Promise.resolve(sampleMessagesList(params));
    return request("GET", "", {
      query: {
        conversation_id: params.conversationId,
        page: params.page,
        page_size: params.pageSize,
        cursor: params.cursor,
      },
    });
  },

  getById(id: string): Promise<SsMessage> {
    return request("GET", `/${id}`, {});
  },

  send(body: Record<string, unknown>): Promise<SsMessage> {
    if (useSampleData()) return Promise.resolve(sampleSendMessage(body));
    return request("POST", "", { body });
  },

  createInternalNote(body: Record<string, unknown>): Promise<SsMessage> {
    if (useSampleData()) return Promise.resolve(sampleCreateInternalNote(body));
    return request("POST", "/internal-notes", { body });
  },

  mentionUsers(): Promise<unknown> {
    return request("GET", "/mention-users", {});
  },

  react(id: string, body: unknown): Promise<unknown> {
    return request("POST", `/${id}/react`, { body });
  },

  removeReaction(id: string, body: unknown): Promise<unknown> {
    return request("DELETE", `/${id}/react`, { body });
  },

  translate(id: string, body: unknown): Promise<unknown> {
    return request("POST", `/${id}/translate`, { body });
  },
};

import { AppError } from "../../utils/error-handler";
import { sendSevenRaw, sendSevenRequest, sendSevenUpload, useSampleData, type SsQuery } from "../../utils/sendseven";
import { sampleCreateInternalNote, sampleMessagesList, sampleSendMessage } from "./messages.fixtures";
import type {
  AttachmentDownload,
  ListMessagesParams,
  SsAttachmentUpload,
  SsMessage,
  SsMessageList,
} from "./messages.types";

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

  // Phase 1 of the two-phase send: push the bytes to SendSeven and get back an
  // id. Note the path is /attachments/upload, NOT under /messages — attachments
  // are a top-level resource, reusable across messages and channels.
  uploadAttachment(file: { buffer: Buffer; filename: string; contentType: string }): Promise<SsAttachmentUpload> {
    return sendSevenUpload<SsAttachmentUpload>("/attachments/upload", file);
  },

  // Streams an attachment's bytes from SendSeven (auth + X-Tenant-ID applied by
  // the shared client). Used to proxy inline images/files so the browser never
  // needs the workspace token. `disposition=inline` so images render in-page.
  async downloadAttachment(attachmentId: string): Promise<AttachmentDownload> {
    const upstream = await sendSevenRaw("GET", `/attachments/${attachmentId}/download`, {
      query: { disposition: "inline" },
    });
    if (!upstream.ok) {
      const status = upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502;
      throw new AppError(`Failed to load attachment (${upstream.status})`, status);
    }
    return {
      buffer: Buffer.from(await upstream.arrayBuffer()),
      contentType: upstream.headers.get("content-type") ?? "application/octet-stream",
      cacheControl: upstream.headers.get("cache-control"),
    };
  },
};

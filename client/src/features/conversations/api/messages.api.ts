import axiosClient from "@/api/client/axios-client";

// Typed client for the SendSeven messages API, proxied through our server at
// `/api/v2/messages`. The axios interceptor unwraps the envelope → returns `data`.

const BASE = "/api/v2/messages";

export type MessageDirection = "inbound" | "outbound";
export type MessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "location"
  | "contact"
  | "sticker"
  | "system"
  | "interactive"
  | "file"
  | (string & {});
export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed" | (string & {});

export interface SsMessageAttachment {
  id: string;
  filename: string;
  content_type: string;
  file_size: number;
  storage_path: string;
  url?: string | null;
  created_at: string;
}

export interface SsMessage {
  id: string;
  conversation_id: string;
  direction: MessageDirection;
  message_type: MessageType;
  status: MessageStatus;
  created_at: string;
  tenant_id?: string | null;
  channel_id?: string | null;
  contact_id?: string | null;
  from?: string | null;
  to?: string | null;
  text?: string | null;
  attachments?: SsMessageAttachment[];
  is_internal?: boolean | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  error_message?: string | null;
  [key: string]: unknown;
}

export interface SsMessagePaginationMeta {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
  next_cursor?: string | null;
  prev_cursor?: string | null;
  has_more?: boolean;
}

export interface SsMessageList {
  items: SsMessage[];
  pagination: SsMessagePaginationMeta;
}

export interface ListMessagesQuery {
  conversationId: string;
  page?: number;
  pageSize?: number;
  cursor?: string;
}

// POST /messages — a text reply is the common case; other fields are optional.
export interface MessageCreate {
  conversation_id?: string | null;
  channel_id?: string | null;
  contact_id?: string | null;
  contact_method_id?: string | null;
  to?: unknown;
  message_type?: MessageType;
  text?: string | null;
  subject?: string | null;
  attachments?: string[];
  attachment_filenames?: string[] | null;
  sender_id?: string | null;
  include_signature?: boolean | null;
  meta?: Record<string, unknown>;
}

export interface InternalNoteCreate {
  conversation_id: string;
  text: string;
  meta?: Record<string, unknown>;
}

/** Result of uploading a file. `id` is what goes in MessageCreate.attachments. */
export interface SsAttachmentUpload {
  id: string;
  attachment_id: string;
  filename: string;
  content_type: string;
  size: number;
}

/** SendSeven's documented per-file limit; checked client-side too so an oversized
 *  file fails instantly instead of after uploading 50MB+ to be rejected. */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export const messagesApi = {
  list: async (query: ListMessagesQuery): Promise<SsMessageList> => {
    const { data } = await axiosClient.get<SsMessageList>(BASE, {
      params: {
        conversation_id: query.conversationId,
        page: query.page,
        page_size: query.pageSize,
        cursor: query.cursor,
      },
    });
    return data;
  },
  getById: async (id: string): Promise<SsMessage> => {
    const { data } = await axiosClient.get<SsMessage>(`${BASE}/${id}`);
    return data;
  },
  send: async (body: MessageCreate): Promise<SsMessage> => {
    const { data } = await axiosClient.post<SsMessage>(BASE, body);
    return data;
  },
  // Phase 1 of a send-with-attachment. Goes through our own proxy rather than
  // straight to SendSeven so the workspace token stays server-side. Axios swaps
  // the declared multipart type for one carrying the real boundary.
  uploadAttachment: async (file: File): Promise<SsAttachmentUpload> => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await axiosClient.post<SsAttachmentUpload>(`${BASE}/attachments/upload`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  createInternalNote: async (body: InternalNoteCreate): Promise<SsMessage> => {
    const { data } = await axiosClient.post<SsMessage>(`${BASE}/internal-notes`, body);
    return data;
  },
  mentionUsers: async (): Promise<Record<string, unknown>> => {
    const { data } = await axiosClient.get<Record<string, unknown>>(`${BASE}/mention-users`);
    return data;
  },
  react: async (id: string, body: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const { data } = await axiosClient.post<Record<string, unknown>>(`${BASE}/${id}/react`, body);
    return data;
  },
  removeReaction: async (id: string, body: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const { data } = await axiosClient.delete<Record<string, unknown>>(`${BASE}/${id}/react`, { data: body });
    return data;
  },
  translate: async (id: string, body: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const { data } = await axiosClient.post<Record<string, unknown>>(`${BASE}/${id}/translate`, body);
    return data;
  },
  // Streams an attachment's bytes through our server proxy (auth via the shared
  // axios client / session cookie) so images render without exposing the
  // SendSeven token or depending on the page's origin resolving the raw path.
  attachmentBlob: async (attachmentId: string): Promise<Blob> => {
    const { data } = await axiosClient.get<Blob>(`${BASE}/attachments/${attachmentId}/download`, {
      responseType: "blob",
    });
    return data;
  },
};

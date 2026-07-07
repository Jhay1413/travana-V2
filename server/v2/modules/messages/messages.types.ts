// SendSeven message shapes the proxy + fixtures rely on. Full typed surface for
// the client lives in client/src/features/conversations/api/messages.api.ts.

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
  direction: "inbound" | "outbound";
  message_type: string;
  status: string;
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

export interface ListMessagesParams {
  conversationId?: string;
  page?: number;
  pageSize?: number;
  cursor?: string;
}

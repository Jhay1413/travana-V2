// SendSeven conversation shapes the proxy + fixtures need. The full typed
// surface for every operation lives client-side in
// client/src/features/conversations/api. The server is a thin gateway, so it
// only models what the fixtures and list filtering rely on.

export interface SsTagInfo {
  id: string;
  name: string;
  color?: string | null;
}

export interface SsLastMessagePreview {
  text?: string | null;
  message_type?: string;
  direction?: string;
  created_at?: string | null;
}

export interface SsPaginationMeta {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
  next_cursor?: string | null;
  prev_cursor?: string | null;
}

export interface SsConversation {
  id: string;
  tenant_id: string;
  channel_id: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
  contact_id?: string | null;
  channel_type?: string | null;
  contact?: Record<string, unknown> | null;
  assigned_user_id?: string | null;
  assigned_user?: Record<string, unknown> | null;
  subject?: string | null;
  last_message_at?: string | null;
  last_message?: SsLastMessagePreview | null;
  is_live_chat?: boolean;
  is_email?: boolean;
  needs_reply?: boolean;
  tags?: SsTagInfo[] | null;
  snoozed_until?: string | null;
  [key: string]: unknown;
}

export interface SsConversationList {
  items: SsConversation[];
  pagination: SsPaginationMeta;
}

export interface SsBadgeCounts {
  unanswered_assigned_to_me: number;
  unassigned_count: number;
  total_unanswered: number;
  open_count: number;
  snoozed_count: number;
  is_multi_agent: boolean;
}

// Query params for GET /conversations (list), camelCase at our boundary.
export interface ListConversationsParams {
  page?: number;
  pageSize?: number;
  status?: string;
  assignedTo?: string;
  needsReply?: boolean;
  filter?: string;
  contactId?: string;
  search?: string;
  inboxId?: string;
}

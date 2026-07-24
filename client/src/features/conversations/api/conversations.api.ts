import axiosClient from "@/api/client/axios-client";

// Typed client for the SendSeven conversations API, proxied through our server
// at `/api/v2/conversations`. The axios response interceptor unwraps the
// `{ success, message, data }` envelope, so methods return the `data` payload.

const BASE = "/api/v2/conversations";

// ─── Core entity shapes ───────────────────────────────────────────────────────

export type ConversationStatus = "open" | "assigned" | "resolved" | "closed";

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

export interface SsContactMethodInfo {
  id: string;
  method_type: string;
  value: string;
  display_name?: string | null;
  is_primary?: boolean;
}

export interface SsConversation {
  id: string;
  tenant_id: string;
  channel_id: string;
  status: ConversationStatus | string;
  created_at: string;
  updated_at?: string | null;
  contact_id?: string | null;
  channel_type?: string | null;
  contact_method_id?: string | null;
  active_contact_method_id?: string | null;
  contact_method?: SsContactMethodInfo | null;
  active_contact_method?: SsContactMethodInfo | null;
  assigned_user_id?: string | null;
  assigned_user?: Record<string, unknown> | null;
  subject?: string | null;
  last_message_at?: string | null;
  last_message?: SsLastMessagePreview | null;
  contact?: Record<string, unknown> | null;
  is_live_chat?: boolean;
  is_email?: boolean;
  needs_reply?: boolean;
  tags?: SsTagInfo[] | null;
  snoozed_until?: string | null;
  snooze_reopen_on_message?: boolean | null;
  closed_at?: string | null;
  ai_summary?: string | null;
  user_intent?: string | null;
  resolution_summary?: string | null;
  ai_tags?: string[] | null;
  [key: string]: unknown;
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

// Per-conversation AI auto-reply state: whether the AI is actively replying,
// or paused (e.g. a human took over the thread).
export interface ConversationAiState {
  aiActive: boolean;
  needsHuman: boolean;
  handledByHumanAt: string | null;
  updatedAt: string | null;
}

// ─── Request / response payloads ──────────────────────────────────────────────

export interface ListConversationsQuery {
  page?: number;
  pageSize?: number;
  /** Tab filter: 'open' | 'snoozed' | 'closed'. */
  status?: string;
  /** 'me' | 'unassigned' | 'me_and_unassigned' | userId. */
  assignedTo?: string;
  needsReply?: boolean;
  /** e.g. 'unanswered'. */
  filter?: string;
  contactId?: string;
  search?: string;
  inboxId?: string;
}

export interface ConversationCreate {
  contact_id: string;
  channel_id: string;
  subject?: string | null;
  contact_method_id?: string | null;
}

export interface ConversationUpdate {
  status?: ConversationStatus | null;
  assigned_user_id?: string | null;
  subject?: string | null;
  notes?: string | null;
  needs_reply?: boolean | null;
}

export interface CloseConversationRequest {
  notes?: string | null;
  summarize?: boolean | null;
}

export interface SnoozeConversationRequest {
  snoozed_until: string;
  reopen_on_message?: boolean;
}

export interface ConversationMergeRequest {
  source_conversation_id: string;
}

export interface BulkCloseRequest {
  conversation_ids: string[];
  reason?: string | null;
}

export interface BulkCloseResponse {
  success_count: number;
  failed_count: number;
  failed_ids: string[];
}

export interface SwitchableChannelInfo {
  channel_id: string;
  channel_name: string;
  channel_type: string;
  identifier: string;
}
export interface SwitchableChannelsResponse {
  channels: SwitchableChannelInfo[];
}

export interface SenderOptionOut {
  id: string;
  source_type: string;
  name: string;
  email_address?: string | null;
  is_default?: boolean;
  is_default_reply_sender?: boolean;
  is_acl_override?: boolean;
}
export interface SenderOptionsResponse {
  options: SenderOptionOut[];
  default_option_id?: string | null;
  default_reply_sender_id?: string | null;
}

export interface ChannelSwitchRequest {
  channel_ids?: string[] | null;
}
export interface ChannelDeeplinkInfo {
  [key: string]: unknown;
}
export interface ChannelSwitchResponse {
  token: string;
  deeplinks: ChannelDeeplinkInfo[];
  expires_at: string;
  share_token_id: string;
}

export type InitiateMessageType = "text" | "template" | "email";
export interface InitiateEmailData {
  subject: string;
  body_html: string;
  include_signature?: boolean;
  from_email?: string | null;
  from_name?: string | null;
  cc?: string[];
  bcc?: string[];
}
export interface InitiateConversationRequest {
  contact_id: string;
  channel_id: string;
  message_type?: InitiateMessageType;
  content?: string | null;
  template?: Record<string, unknown> | null;
  email?: InitiateEmailData | null;
}
export interface InitiateConversationResponse {
  conversation_id: string;
  message_id?: string | null;
  channel_type: string;
  status: string;
  requires_template?: boolean;
  window_status?: Record<string, unknown> | null;
  error?: string | null;
}

export interface CheckExistingConversationRequest {
  contact_id: string;
  channel_id: string;
}
export interface ExistingConversationInfo {
  conversation_id: string;
  message_count?: number;
  last_message_at?: string | null;
  closed_at?: string | null;
}
export interface CheckExistingConversationResponse {
  has_existing_open: boolean;
  existing_open_conversation_id?: string | null;
  has_existing_closed: boolean;
  existing_closed_info?: ExistingConversationInfo | null;
  channel_type: string;
  window_status?: Record<string, unknown> | null;
}

export interface OpenOrCreateConversationRequest {
  contact_id: string;
  channel_id: string;
  contact_method_id?: string | null;
  action?: string | null;
  reopen_existing?: boolean;
  use_conversation_id?: string | null;
}
export interface OpenOrCreateConversationResponse {
  conversation_id: string;
  is_new: boolean;
  is_reopened?: boolean;
  channel_type: string;
  window_status?: Record<string, unknown> | null;
  existing_closed_conversation?: ExistingConversationInfo | null;
  existing_open_email_threads?: Record<string, unknown>[] | null;
}

export interface TranscriptExportRequest {
  format: "pdf" | "zip";
  wait_for_summary?: boolean;
}
export interface TranscriptExportJobResponse {
  job_id: string;
  conversation_id: string;
  format: string;
  status: string;
  progress_percent?: number;
  message?: string | null;
  download_url?: string | null;
  storage_path?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at?: string | null;
  completed_at?: string | null;
}

export interface ConversationSummaryDetail {
  conversation_id: string;
  user_intent?: string | null;
  summary?: string | null;
  resolution?: string | null;
  summarized_at?: string | null;
}

export interface PreviousConversationItem {
  id: string;
  status: string;
  subject?: string | null;
  channel_id?: string | null;
  channel_type?: string | null;
  created_at?: string | null;
  last_message_at?: string | null;
  closed_at?: string | null;
  ai_summary?: string | null;
  user_intent?: string | null;
  resolution_summary?: string | null;
  message_count?: number;
  last_message_preview?: string | null;
}
export interface PreviousConversationsResponse {
  items: PreviousConversationItem[];
  total_previous: number;
  distinct_channel_count: number;
  latest_previous_at?: string | null;
  mergeable: boolean;
  merge_target_conversation_id?: string | null;
}

// ─── API surface (all 29 conversation operations) ─────────────────────────────

export const conversationsApi = {
  // Reads
  list: async (query: ListConversationsQuery = {}): Promise<SsConversationList> => {
    const { data } = await axiosClient.get<SsConversationList>(BASE, {
      params: {
        page: query.page,
        page_size: query.pageSize,
        status: query.status,
        assigned_to: query.assignedTo,
        needs_reply: query.needsReply,
        filter: query.filter,
        contact_id: query.contactId,
        search: query.search,
        inbox_id: query.inboxId,
      },
    });
    return data;
  },
  getById: async (id: string): Promise<SsConversation> => {
    const { data } = await axiosClient.get<SsConversation>(`${BASE}/${id}`);
    return data;
  },
  badgeCounts: async (inboxId?: string): Promise<SsBadgeCounts> => {
    const { data } = await axiosClient.get<SsBadgeCounts>(`${BASE}/badge-counts`, { params: { inbox_id: inboxId } });
    return data;
  },
  trendingTags: async (limit?: number): Promise<Record<string, unknown>> => {
    const { data } = await axiosClient.get<Record<string, unknown>>(`${BASE}/analytics/trending-tags`, { params: { limit } });
    return data;
  },
  summary: async (id: string): Promise<ConversationSummaryDetail> => {
    const { data } = await axiosClient.get<ConversationSummaryDetail>(`${BASE}/${id}/summary`);
    return data;
  },
  previous: async (id: string, limit?: number): Promise<PreviousConversationsResponse> => {
    const { data } = await axiosClient.get<PreviousConversationsResponse>(`${BASE}/${id}/previous`, { params: { limit } });
    return data;
  },
  switchableChannels: async (id: string): Promise<SwitchableChannelsResponse> => {
    const { data } = await axiosClient.get<SwitchableChannelsResponse>(`${BASE}/${id}/switchable-channels`);
    return data;
  },
  senderOptions: async (id: string): Promise<SenderOptionsResponse> => {
    const { data } = await axiosClient.get<SenderOptionsResponse>(`${BASE}/${id}/sender-options`);
    return data;
  },
  botSession: async (id: string): Promise<Record<string, unknown>> => {
    const { data } = await axiosClient.get<Record<string, unknown>>(`${BASE}/${id}/bot-session`);
    return data;
  },
  availableBots: async (id: string): Promise<Record<string, unknown>> => {
    const { data } = await axiosClient.get<Record<string, unknown>>(`${BASE}/${id}/available-bots`);
    return data;
  },
  transcriptStatus: async (id: string, jobId: string): Promise<TranscriptExportJobResponse> => {
    const { data } = await axiosClient.get<TranscriptExportJobResponse>(`${BASE}/${id}/transcript/${jobId}`);
    return data;
  },
  aiState: async (id: string): Promise<ConversationAiState> => {
    const { data } = await axiosClient.get<ConversationAiState>(`${BASE}/${id}/ai-state`);
    return data;
  },

  // Writes — single conversation
  create: async (body: ConversationCreate): Promise<SsConversation> => {
    const { data } = await axiosClient.post<SsConversation>(BASE, body);
    return data;
  },
  update: async (id: string, body: ConversationUpdate): Promise<SsConversation> => {
    const { data } = await axiosClient.patch<SsConversation>(`${BASE}/${id}`, body);
    return data;
  },
  assign: async (id: string, userId: string): Promise<SsConversation> => {
    const { data } = await axiosClient.post<SsConversation>(`${BASE}/${id}/assign/${userId}`);
    return data;
  },
  close: async (id: string, body: CloseConversationRequest = {}): Promise<SsConversation> => {
    const { data } = await axiosClient.post<SsConversation>(`${BASE}/${id}/close`, body);
    return data;
  },
  reopen: async (id: string): Promise<SsConversation> => {
    const { data } = await axiosClient.post<SsConversation>(`${BASE}/${id}/reopen`);
    return data;
  },
  snooze: async (id: string, body: SnoozeConversationRequest): Promise<SsConversation> => {
    const { data } = await axiosClient.post<SsConversation>(`${BASE}/${id}/snooze`, body);
    return data;
  },
  unsnooze: async (id: string): Promise<SsConversation> => {
    const { data } = await axiosClient.delete<SsConversation>(`${BASE}/${id}/snooze`);
    return data;
  },
  merge: async (id: string, body: ConversationMergeRequest): Promise<SsConversation> => {
    const { data } = await axiosClient.post<SsConversation>(`${BASE}/${id}/merge`, body);
    return data;
  },
  summarize: async (id: string): Promise<Record<string, unknown>> => {
    const { data } = await axiosClient.post<Record<string, unknown>>(`${BASE}/${id}/summarize`);
    return data;
  },
  transcriptExport: async (id: string, body: TranscriptExportRequest): Promise<TranscriptExportJobResponse> => {
    const { data } = await axiosClient.post<TranscriptExportJobResponse>(`${BASE}/${id}/transcript`, body);
    return data;
  },
  switchChannel: async (id: string, body: ChannelSwitchRequest = {}): Promise<ChannelSwitchResponse> => {
    const { data } = await axiosClient.post<ChannelSwitchResponse>(`${BASE}/${id}/switch-channel`, body);
    return data;
  },
  botEnable: async (id: string, botId?: string): Promise<Record<string, unknown>> => {
    const { data } = await axiosClient.post<Record<string, unknown>>(`${BASE}/${id}/bot-session/enable`, undefined, { params: { bot_id: botId } });
    return data;
  },
  botDisable: async (id: string): Promise<Record<string, unknown>> => {
    const { data } = await axiosClient.post<Record<string, unknown>>(`${BASE}/${id}/bot-session/disable`);
    return data;
  },
  aiStateEnable: async (id: string): Promise<ConversationAiState> => {
    const { data } = await axiosClient.post<ConversationAiState>(`${BASE}/${id}/ai-state/enable`);
    return data;
  },
  aiStateDisable: async (id: string): Promise<ConversationAiState> => {
    const { data } = await axiosClient.post<ConversationAiState>(`${BASE}/${id}/ai-state/disable`);
    return data;
  },

  // Writes — collection level
  bulkClose: async (body: BulkCloseRequest): Promise<BulkCloseResponse> => {
    const { data } = await axiosClient.post<BulkCloseResponse>(`${BASE}/bulk-close`, body);
    return data;
  },
  searchSimilar: async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const { data } = await axiosClient.post<Record<string, unknown>>(`${BASE}/search-similar`, body);
    return data;
  },
  initiate: async (body: InitiateConversationRequest): Promise<InitiateConversationResponse> => {
    const { data } = await axiosClient.post<InitiateConversationResponse>(`${BASE}/initiate`, body);
    return data;
  },
  checkExisting: async (body: CheckExistingConversationRequest): Promise<CheckExistingConversationResponse> => {
    const { data } = await axiosClient.post<CheckExistingConversationResponse>(`${BASE}/check-existing`, body);
    return data;
  },
  openOrCreate: async (body: OpenOrCreateConversationRequest): Promise<OpenOrCreateConversationResponse> => {
    const { data } = await axiosClient.post<OpenOrCreateConversationResponse>(`${BASE}/open-or-create`, body);
    return data;
  },
};

import type {
  ListConversationsParams,
  SsBadgeCounts,
  SsConversation,
  SsConversationList,
} from "./conversations.types";

// Temporary sample data used ONLY while the external conversations service is
// not configured (no CONVERSATIONS_API_URL / CONVERSATIONS_API_TOKEN). Kept in
// SendSeven's snake_case shape so it flows through the proxy untouched — delete
// this file (and the fallbacks in the repository) once the token is available.

export const SAMPLE_CONVERSATIONS: SsConversation[] = [
  {
    id: "conv-sarah",
    tenant_id: "tenant-demo",
    channel_id: "ig-001",
    channel_type: "instagram",
    contact_id: "contact-sarah",
    contact: { id: "contact-sarah", name: "Sarah Johnson", email: "sarah.johnson@example.com" },
    is_email: false,
    is_live_chat: false,
    status: "open",
    needs_reply: false,
    created_at: "2025-01-14T09:00:00Z",
    updated_at: "2025-01-15T14:22:00Z",
    last_message_at: "2025-01-15T14:22:00Z",
    last_message: { created_at: "2025-01-15T14:22:00Z", direction: "inbound", message_type: "text", text: "Ordered! 🤩 Bring on the summer." },
    tags: [{ id: "tag-vip", name: "VIP", color: "#FFD700" }],
  },
  {
    id: "conv-michael",
    tenant_id: "tenant-demo",
    channel_id: "wa-001",
    channel_type: "whatsapp",
    contact_id: "contact-michael",
    contact: { id: "contact-michael", name: "Michael Brown", phone: "+44 7700 900112" },
    is_email: false,
    is_live_chat: false,
    status: "open",
    needs_reply: true,
    created_at: "2025-01-14T16:00:00Z",
    updated_at: "2025-01-14T16:40:00Z",
    last_message_at: "2025-01-14T16:40:00Z",
    last_message: { created_at: "2025-01-14T16:40:00Z", direction: "inbound", message_type: "text", text: "Yes" },
    tags: [],
  },
  {
    id: "conv-emma",
    tenant_id: "tenant-demo",
    channel_id: "em-001",
    channel_type: "email",
    contact_id: "contact-emma",
    contact: { id: "contact-emma", name: "Emma Davis", email: "emma.davis@example.com" },
    is_email: true,
    is_live_chat: false,
    status: "open",
    needs_reply: false,
    created_at: "2025-01-14T11:00:00Z",
    updated_at: "2025-01-14T11:05:00Z",
    last_message_at: "2025-01-14T11:05:00Z",
    last_message: { created_at: "2025-01-14T11:05:00Z", direction: "outbound", message_type: "text", text: "Welcome and congratulations on your new e-bike!" },
    tags: [{ id: "tag-onboarding", name: "Onboarding", color: "#22C55E" }],
  },
  {
    id: "conv-james",
    tenant_id: "tenant-demo",
    channel_id: "ms-001",
    channel_type: "messenger",
    contact_id: "contact-james",
    contact: { id: "contact-james", name: "James Wilson" },
    is_email: false,
    is_live_chat: false,
    status: "assigned",
    needs_reply: false,
    created_at: "2025-01-14T09:00:00Z",
    updated_at: "2025-01-14T09:12:00Z",
    last_message_at: "2025-01-14T09:12:00Z",
    last_message: { created_at: "2025-01-14T09:12:00Z", direction: "outbound", message_type: "text", text: "It sounds like sleep mode. Does this help?" },
    tags: [{ id: "tag-support", name: "Support", color: "#3B82F6" }],
  },
  {
    id: "conv-lisa",
    tenant_id: "tenant-demo",
    channel_id: "sms-001",
    channel_type: "sms",
    contact_id: "contact-lisa",
    contact: { id: "contact-lisa", name: "Lisa King", phone: "+44 7700 900456" },
    is_email: false,
    is_live_chat: false,
    status: "open",
    needs_reply: false,
    created_at: "2025-01-14T08:30:00Z",
    updated_at: "2025-01-14T08:30:00Z",
    last_message_at: "2025-01-14T08:30:00Z",
    last_message: { created_at: "2025-01-14T08:30:00Z", direction: "outbound", message_type: "text", text: "Appointment tomorrow at 3pm — reply YES to confirm." },
    tags: [],
  },
  {
    id: "conv-tom",
    tenant_id: "tenant-demo",
    channel_id: "wa-002",
    channel_type: "whatsapp",
    contact_id: "contact-tom",
    contact: { id: "contact-tom", name: "Tom Becker", phone: "+49 151 23456789" },
    is_email: false,
    is_live_chat: false,
    status: "open",
    needs_reply: true,
    created_at: "2025-01-14T07:50:00Z",
    updated_at: "2025-01-14T07:50:00Z",
    last_message_at: "2025-01-14T07:50:00Z",
    last_message: { created_at: "2025-01-14T07:50:00Z", direction: "inbound", message_type: "text", text: "Where is my order?" },
    tags: [{ id: "tag-urgent", name: "Urgent", color: "#EF4444" }],
  },
  {
    id: "conv-mia",
    tenant_id: "tenant-demo",
    channel_id: "sms-002",
    channel_type: "sms",
    contact_id: "contact-mia",
    contact: { id: "contact-mia", name: "Mia Klein", phone: "+49 160 99887766" },
    is_email: false,
    is_live_chat: false,
    status: "snoozed",
    needs_reply: false,
    snoozed_until: "2025-01-20T09:00:00Z",
    created_at: "2025-01-14T06:15:00Z",
    updated_at: "2025-01-14T06:15:00Z",
    last_message_at: "2025-01-14T06:15:00Z",
    last_message: { created_at: "2025-01-14T06:15:00Z", direction: "outbound", message_type: "text", text: "Thanks for subscribing to our newsletter." },
    tags: [],
  },
  {
    id: "conv-oliver",
    tenant_id: "tenant-demo",
    channel_id: "em-002",
    channel_type: "email",
    contact_id: "contact-oliver",
    contact: { id: "contact-oliver", name: "Oliver Schmidt", email: "oliver.schmidt@example.com" },
    is_email: true,
    is_live_chat: false,
    status: "closed",
    needs_reply: false,
    created_at: "2025-01-12T15:00:00Z",
    updated_at: "2025-01-12T15:40:00Z",
    last_message_at: "2025-01-12T15:40:00Z",
    closed_at: "2025-01-12T15:45:00Z",
    last_message: { created_at: "2025-01-12T15:40:00Z", direction: "inbound", message_type: "text", text: "Thanks for the quick refund! Really appreciated." },
    tags: [{ id: "tag-resolved", name: "Resolved", color: "#22C55E" }],
  },
];

// The list `status` filter is a tab concept (open/snoozed/closed); the stored
// status enum is open/assigned/resolved/closed. Map a tab to matching statuses.
function matchesStatusTab(conv: SsConversation, tab: string): boolean {
  if (tab === "snoozed") return conv.status === "snoozed" || !!conv.snoozed_until;
  if (tab === "closed") return conv.status === "closed" || conv.status === "resolved";
  if (tab === "open") return conv.status === "open" || conv.status === "assigned";
  return conv.status === tab;
}

export function sampleConversationList(params: ListConversationsParams): SsConversationList {
  const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 20;
  const page = params.page && params.page > 0 ? params.page : 1;

  let filtered = SAMPLE_CONVERSATIONS;
  if (params.status) filtered = filtered.filter((c) => matchesStatusTab(c, params.status as string));
  if (params.contactId) filtered = filtered.filter((c) => c.contact_id === params.contactId);
  if (params.needsReply !== undefined) filtered = filtered.filter((c) => !!c.needs_reply === params.needsReply);
  if (params.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter((c) => {
      const name = String((c.contact as Record<string, unknown> | null)?.name ?? "").toLowerCase();
      return name.includes(q) || (c.last_message?.text ?? "").toLowerCase().includes(q);
    });
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return {
    items,
    pagination: {
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
      next_cursor: null,
      prev_cursor: null,
    },
  };
}

export function sampleConversationById(id: string): SsConversation | null {
  return SAMPLE_CONVERSATIONS.find((c) => c.id === id) ?? null;
}

// Returns the sample conversation with a shallow patch applied — used so the
// single-conversation write ops (close/reopen/snooze/assign/update) behave
// end-to-end in fixture mode.
export function sampleConversationPatched(id: string, patch: Partial<SsConversation>): SsConversation | null {
  const found = sampleConversationById(id);
  if (!found) return null;
  return { ...found, ...patch, updated_at: new Date().toISOString() };
}

export function sampleBadgeCounts(): SsBadgeCounts {
  const open = SAMPLE_CONVERSATIONS.filter((c) => matchesStatusTab(c, "open"));
  const snoozed = SAMPLE_CONVERSATIONS.filter((c) => matchesStatusTab(c, "snoozed"));
  const unanswered = open.filter((c) => c.needs_reply);
  const unassigned = open.filter((c) => !c.assigned_user_id);
  return {
    unanswered_assigned_to_me: 0,
    unassigned_count: unassigned.length,
    total_unanswered: unanswered.length,
    open_count: open.length,
    snoozed_count: snoozed.length,
    is_multi_agent: true,
  };
}

import type { SsConversation } from "./api/conversations.api";
import type { SsMessage } from "./api/messages.api";
import { CHANNELS } from "./channels";
import type { Conversation, ConversationChannel, ConversationMessage, ConversationStatus } from "./types";

// Maps a SendSeven message onto the UI thread model.
export function toUiMessage(m: SsMessage): ConversationMessage {
  return {
    id: m.id,
    direction: m.direction === "outbound" ? "outbound" : "inbound",
    body: m.text ?? "",
    sentAt: m.sent_at ?? m.created_at,
    read: !!m.read_at,
    isNote: !!m.is_internal,
  };
}

// Maps a SendSeven channel_type (+ email/live-chat flags) onto the five UI
// channels the inbox renders. Unknown channels fall back to SMS so the row
// still renders with a sensible icon.
export function toUiChannel(channelType: string | null | undefined, isEmail: boolean, isLiveChat: boolean): ConversationChannel {
  if (isEmail) return "email";
  const t = (channelType || "").toLowerCase();
  if (t.includes("whatsapp")) return "whatsapp";
  if (t.includes("insta")) return "instagram";
  if (t.includes("messenger") || t.includes("facebook") || t.includes("fb")) return "messenger";
  if (t.includes("email") || t.includes("mail")) return "email";
  if (t.includes("sms") || t.includes("text") || t.includes("phone")) return "sms";
  if (isLiveChat) return "messenger";
  return "sms";
}

// The stored status enum is open|assigned|resolved|closed; the UI shows two
// tabs. Snoozed conversations are treated as open for display purposes.
function toUiStatus(status: string): ConversationStatus {
  const s = (status || "").toLowerCase();
  return s === "closed" || s === "resolved" ? "closed" : "open";
}

function splitName(name: string): { first: string; last: string } {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? name ?? "", last: parts.slice(1).join(" ") };
}

// SendSeven's `contact` is a loose object — read what we can defensively.
function readContact(contact: Record<string, unknown> | null | undefined) {
  const c = contact ?? {};
  const str = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : undefined);
  return {
    id: str("id"),
    name: str("name") ?? str("display_name") ?? str("full_name"),
    phone: str("phone") ?? str("phone_number"),
    email: str("email") ?? str("email_address"),
  };
}

// Turns a SendSeven conversation into the UI model. Because only the list
// endpoint drives the inbox, the thread is seeded with the single
// `last_message`; the full history arrives via the messages API later.
export function toUiConversation(item: SsConversation): Conversation {
  const channel = toUiChannel(item.channel_type, !!item.is_email, !!item.is_live_chat);
  const contact = readContact(item.contact);
  const displayName = contact.name || item.subject || "Unknown";
  const { first, last } = splitName(displayName);
  const handle = contact.phone ?? contact.email ?? contact.id ?? item.contact_id ?? "";
  const handleLabel =
    channel === "email"
      ? "Email"
      : channel === "instagram"
        ? "Instagram"
        : channel === "messenger"
          ? "Messenger"
          : `${CHANNELS[channel].label} (Phone)`;

  const lastActivityAt = item.last_message_at ?? item.updated_at ?? item.created_at;
  const assignedUser = item.assigned_user as Record<string, unknown> | null | undefined;
  const assignee = typeof assignedUser?.name === "string" ? (assignedUser.name as string) : undefined;

  return {
    id: item.id,
    channel,
    status: toUiStatus(item.status),
    assignee,
    unread: !!item.needs_reply,
    preview: item.last_message?.text ?? "",
    lastActivityAt,
    tags: (item.tags ?? []).map((t) => ({ id: t.id, name: t.name, color: t.color ?? "#94a3b8" })),
    contact: {
      id: contact.id ?? item.contact_id ?? item.id,
      displayName,
      firstName: first,
      lastName: last,
      languages: [],
      handle,
      handleLabel,
      customFields: [],
    },
    messages: item.last_message?.text
      ? [
          {
            id: `${item.id}-last`,
            direction: item.last_message.direction === "outbound" ? "outbound" : "inbound",
            body: item.last_message.text,
            sentAt: item.last_message.created_at ?? lastActivityAt,
          },
        ]
      : [],
  };
}

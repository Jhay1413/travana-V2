import type { SsConversation, SsLastMessagePreview } from "./api/conversations.api";
import type { SsMessage, SsMessageAttachment } from "./api/messages.api";
import { CHANNELS } from "./channels";
import type { Conversation, ConversationChannel, ConversationMessage, ConversationStatus, MessageAttachment } from "./types";

// Routes attachment bytes through our server proxy so the browser never needs the
// SendSeven workspace token (see server messages downloadAttachment).
function toUiAttachment(a: SsMessageAttachment): MessageAttachment {
  return {
    id: a.id,
    filename: a.filename,
    contentType: a.content_type,
    url: `/api/v2/messages/attachments/${a.id}/download`,
    isImage: (a.content_type || "").toLowerCase().startsWith("image/"),
  };
}

// A one-line preview for a message that has no text (e.g. a photo/file), so list
// rows and seeds don't render blank.
function mediaPreview(messageType: string | null | undefined): string {
  switch ((messageType || "").toLowerCase()) {
    case "image":
      return "📷 Photo";
    case "video":
      return "🎥 Video";
    case "audio":
      return "🎵 Audio";
    case "document":
    case "file":
      return "📎 Attachment";
    case "sticker":
      return "Sticker";
    case "location":
      return "📍 Location";
    default:
      return "";
  }
}

// Maps a SendSeven message onto the UI thread model.
export function toUiMessage(m: SsMessage): ConversationMessage {
  return {
    id: m.id,
    direction: m.direction === "outbound" ? "outbound" : "inbound",
    body: m.text ?? "",
    sentAt: m.sent_at ?? m.created_at,
    read: !!m.read_at,
    isNote: !!m.is_internal,
    attachments: (m.attachments ?? []).map(toUiAttachment),
  };
}

// The list row / seed preview: message text, or a media placeholder when empty.
function lastMessagePreview(last: SsLastMessagePreview | null | undefined): string {
  return last?.text?.trim() || mediaPreview(last?.message_type);
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

// Picks whichever of two ISO timestamps is chronologically newer, comparing
// parsed dates rather than raw strings. Falls back to whichever is present.
function newestTimestamp(a: string | null | undefined, b: string | null | undefined): string | undefined {
  const aTime = a ? Date.parse(a) : NaN;
  const bTime = b ? Date.parse(b) : NaN;
  if (Number.isNaN(aTime)) return b ?? undefined;
  if (Number.isNaN(bTime)) return a ?? undefined;
  return aTime >= bTime ? a! : b!;
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

  // SendSeven's `last_message_at` can lag behind the embedded `last_message` for
  // outbound sends, so use whichever timestamp is actually newer.
  const lastActivityAt = newestTimestamp(item.last_message?.created_at, item.last_message_at) ?? item.updated_at ?? item.created_at;
  const assignedUser = item.assigned_user as Record<string, unknown> | null | undefined;
  const assignee = typeof assignedUser?.name === "string" ? (assignedUser.name as string) : undefined;

  return {
    id: item.id,
    channel,
    status: toUiStatus(item.status),
    assignee,
    unread: !!item.needs_reply,
    preview: lastMessagePreview(item.last_message),
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
    // Seed the thread with the single last_message so the row isn't blank before
    // the full history (with attachments) arrives via the messages API.
    messages: item.last_message
      ? [
          {
            id: `${item.id}-last`,
            direction: item.last_message.direction === "outbound" ? "outbound" : "inbound",
            body: lastMessagePreview(item.last_message),
            sentAt: item.last_message.created_at ?? lastActivityAt,
          },
        ]
      : [],
  };
}

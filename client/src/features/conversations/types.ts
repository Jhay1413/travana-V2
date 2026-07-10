// Unified-inbox domain types. A conversation is one thread with a contact on a
// single channel; the inbox aggregates every channel into one list.

export type ConversationChannel =
  | "email"
  | "sms"
  | "whatsapp"
  | "messenger"
  | "instagram";

export type ConversationStatus = "open" | "closed";

export type MessageDirection = "inbound" | "outbound";

export interface ConversationContact {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  languages: string[];
  birthday?: string; // ISO date
  /** Channel-specific handle/address shown under "Contact Channels". */
  handle: string;
  handleLabel: string; // e.g. "Instagram (ID)", "Email", "Phone"
  customFields: { label: string; value: string }[];
}

export interface MessageAttachment {
  id: string;
  filename: string;
  contentType: string;
  /** Same-origin proxy URL that streams the file through our server. */
  url: string;
  /** True when the content type is an image, so the bubble renders it inline. */
  isImage: boolean;
}

export interface ConversationMessage {
  id: string;
  direction: MessageDirection;
  body: string;
  /** ISO timestamp. */
  sentAt: string;
  /** Set for outbound messages sent by a teammate. */
  authorName?: string;
  authorAvatarUrl?: string;
  read?: boolean;
  /** Internal note (not sent to the contact) — rendered distinctly. */
  isNote?: boolean;
  /** Optional rich call-to-action rendered as a button inside the bubble. */
  cta?: { label: string };
  /** Media/files on the message (images render inline, others as chips). */
  attachments?: MessageAttachment[];
}

export interface ConversationTag {
  id: string;
  name: string;
  color: string;
}

export interface Conversation {
  id: string;
  channel: ConversationChannel;
  status: ConversationStatus;
  contact: ConversationContact;
  /** Human agent currently assigned, if any. */
  assignee?: string;
  /** Last message preview + time, precomputed for the list row. */
  preview: string;
  lastActivityAt: string; // ISO timestamp
  unread: boolean;
  tags?: ConversationTag[];
  messages: ConversationMessage[];
}

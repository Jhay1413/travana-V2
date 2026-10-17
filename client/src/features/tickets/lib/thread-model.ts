import type { TicketReply } from "@/features/reply";
import type { Ticket } from "../types";

// Builds the conversation model: the ticket description as the first note,
// then replies nested one level deep, grouped under day dividers.

export interface ThreadAuthor {
  id: string;
  name: string;
  image?: string | null;
}

export interface ThreadNote {
  id: string;
  authorId: string;
  authorName: string;
  authorImage: string | null;
  content: string;
  createdAt: string;
  updatedAt: string | null;
  /** The reply row behind this note, or null for the ticket description. */
  reply: TicketReply | null;
  likeCount: number;
  likedByMe: boolean;
}

export interface ThreadItem {
  note: ThreadNote;
  children: ThreadNote[];
}

export interface NoteDayGroup {
  day: string;
  items: ThreadItem[];
}

const byTime = (a: ThreadNote, b: ThreadNote) => Date.parse(a.createdAt) - Date.parse(b.createdAt);

export function buildThread(
  ticket: Ticket,
  replies: TicketReply[] | undefined,
  users: ThreadAuthor[],
  /** True when files were attached to the ticket itself. */
  hasTicketAttachments = false,
): ThreadItem[] {
  const nameFor = (userId: string, fallback?: string | null) => fallback || users.find((u) => u.id === userId)?.name || "Unknown";
  const imageFor = (userId: string) => users.find((u) => u.id === userId)?.image ?? null;
  const toNote = (r: TicketReply): ThreadNote => ({
    id: r.id,
    authorId: r.userId,
    authorName: nameFor(r.userId),
    authorImage: imageFor(r.userId),
    content: r.content,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    reply: r,
    likeCount: r.likeCount,
    likedByMe: r.likedByMe,
  });

  const items: ThreadItem[] = [];
  // Files on a ticket with no description still need a note to hang from.
  if (ticket.description || hasTicketAttachments) {
    items.push({
      note: {
        id: `ticket-${ticket.id}`,
        authorId: ticket.userId,
        authorName: nameFor(ticket.userId, ticket.userName),
        authorImage: imageFor(ticket.userId),
        content: ticket.description || "Opened the ticket",
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        reply: null,
        likeCount: ticket.likeCount ?? 0,
        likedByMe: !!ticket.likedByMe,
      },
      children: [],
    });
  }

  // A reply whose parent is missing (deleted, or from before parents were
  // tracked) is shown at top level rather than hidden.
  const all = replies ?? [];
  const ids = new Set(all.map((r) => r.id));
  const childrenOf = new Map<string, ThreadNote[]>();
  for (const r of all) {
    if (!r.parentReplyId || !ids.has(r.parentReplyId)) continue;
    const list = childrenOf.get(r.parentReplyId) ?? [];
    list.push(toNote(r));
    childrenOf.set(r.parentReplyId, list);
  }
  for (const r of all.filter((x) => !x.parentReplyId || !ids.has(x.parentReplyId))) {
    items.push({ note: toNote(r), children: (childrenOf.get(r.id) ?? []).sort(byTime) });
  }
  return items.sort((a, b) => byTime(a.note, b.note));
}

/** Day dividers follow the top-level notes; nested replies stay under their parent. */
export function groupByDay(items: ThreadItem[], labelFor: (iso: string) => string): NoteDayGroup[] {
  const out: NoteDayGroup[] = [];
  for (const item of items) {
    const key = labelFor(item.note.createdAt);
    const last = out[out.length - 1];
    if (last && last.day === key) last.items.push(item);
    else out.push({ day: key, items: [item] });
  }
  return out;
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  ChevronDown,
  Ellipsis,
  Heart,
  Link,
  LifeBuoy,
  Loader2,
  Paperclip,
  Pencil,
  Pin,
  Reply as ReplyIcon,
  Share2,
  Smile,
  Trash2,
  Unlink,
  User,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { EMOJI_CATEGORIES } from "@/lib/emoji";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser, useTransactions } from "@/hooks/queries";
import { RichTextDisplay } from "@/components/shared/rich-text-editor";
import { NoteEditor } from "@/components/shared/note-editor";
import { DayDivider, dayLabel } from "@/features/conversations";
import type { User as ApiUser } from "@/features/user/types";
import { useCreateReply, useDeleteReply, useReplies, useToggleReplyLike, useUpdateReply } from "@/features/reply";
import type { TicketReply } from "@/features/reply";
import { authorBubbleClasses } from "../lib/author-colors";
import { useDeleteTicket, useToggleTicketLike, useUpdateTicket } from "../api/use-ticket-mutations";
import { TICKET_STATUSES } from "../types";
import type { Ticket } from "../types";

// Center panel of the tickets inbox — a single ticket's "thread": the original
// description as the first note, followed by day-grouped replies, and a
// composer to add another one. Modelled on ClientChatsTab's ChatComposer and
// the conversations inbox's DayDivider/thread header, since tickets have no
// channel and no reply/note distinction of their own.

// Not part of the conversations feature's public surface — same shape as its
// message-thread.tsx helper, replicated locally.
function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function typeChipClass(type: string): string {
  switch (type) {
    case "Admin": return "bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300";
    case "Build": return "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300";
    case "Sales": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
    default: return "bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60";
  }
}

function formatNoteDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

interface ThreadNote {
  id: string;
  authorId: string;
  authorName: string;
  // The author's uploaded profile photo (user.image), when they have one.
  authorImage: string | null;
  content: string;
  createdAt: string;
  updatedAt: string | null;
  // The reply row behind this note, or null for the ticket description (which
  // likes and edits through the ticket endpoints instead).
  reply: TicketReply | null;
  likeCount: number;
  likedByMe: boolean;
}

// A top-level note plus the replies nested under it (one level deep — the
// server re-points deeper replies at the top-level parent).
interface ThreadItem {
  note: ThreadNote;
  children: ThreadNote[];
}

function buildThread(ticket: Ticket, replies: TicketReply[] | undefined, users: ApiUser[]): ThreadItem[] {
  const nameFor = (userId: string, fallback?: string | null) => {
    if (fallback) return fallback;
    return users.find((u) => u.id === userId)?.name || "Unknown";
  };
  const imageFor = (userId: string) => users.find((u) => u.id === userId)?.image ?? null;
  const byTime = (a: ThreadNote, b: ThreadNote) => Date.parse(a.createdAt) - Date.parse(b.createdAt);
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
  if (ticket.description) {
    items.push({
      note: {
        id: `ticket-${ticket.id}`,
        authorId: ticket.userId,
        authorName: nameFor(ticket.userId, ticket.userName),
        authorImage: imageFor(ticket.userId),
        content: ticket.description,
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
  const topLevel = all.filter((r) => !r.parentReplyId || !ids.has(r.parentReplyId));
  const childrenOf = new Map<string, ThreadNote[]>();
  for (const r of all) {
    if (!r.parentReplyId || !ids.has(r.parentReplyId)) continue;
    const list = childrenOf.get(r.parentReplyId) ?? [];
    list.push(toNote(r));
    childrenOf.set(r.parentReplyId, list);
  }
  for (const r of topLevel) {
    items.push({ note: toNote(r), children: (childrenOf.get(r.id) ?? []).sort(byTime) });
  }
  return items.sort((a, b) => byTime(a.note, b.note));
}

interface NoteDayGroup {
  day: string;
  items: ThreadItem[];
}

// Day dividers follow the top-level notes; nested replies stay under their
// parent whatever day they were posted.
function groupByDay(items: ThreadItem[]): NoteDayGroup[] {
  const out: NoteDayGroup[] = [];
  for (const item of items) {
    const key = dayLabel(item.note.createdAt);
    const last = out[out.length - 1];
    if (last && last.day === key) last.items.push(item);
    else out.push({ day: key, items: [item] });
  }
  return out;
}

// The sender's uploaded profile photo, falling back to their initials — same
// avatar treatment as the quote details Notes tab.
function SenderAvatar({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  if (imageUrl) {
    return <img src={imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#3b82f6]/10 text-[11px] font-bold text-[#3b82f6]">
      {initials(name.trim() || "?")}
    </span>
  );
}

interface NoteActions {
  /** Replies can be deleted from the thread; the ticket itself is deleted from its menu. */
  canDelete: boolean;
  onLike: () => void;
  isLiking: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isEditing: boolean;
  onSaveEdit: (content: string) => void;
  onCancelEdit: () => void;
  isSavingEdit: boolean;
  isConfirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

// Inline editor for one post. Descriptions are rich-text HTML (from the create
// dialog) and replies may be plain text — the shared note editor handles both
// and hands back HTML, which is what the thread renders.
function NoteEditForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: string;
  onSave: (content: string) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  return (
    <div data-testid="ticket-note-edit">
      <NoteEditor initialContent={initial} submitLabel="Save" compact isLoading={isSaving} onSubmit={onSave} onCancel={onCancel} />
    </div>
  );
}


function NoteBubble({
  note,
  isMe,
  nested = false,
  actions,
}: {
  note: ThreadNote;
  isMe: boolean;
  /** Rendered beneath a parent reply — indented to show the thread. */
  nested?: boolean;
  /** Absent for the ticket description, which is not a reply. */
  actions?: NoteActions;
}) {
  const colors = authorBubbleClasses(note.authorId, isMe);
  const isEdited = !!note.updatedAt && Date.parse(note.updatedAt) > Date.parse(note.createdAt) + 1000;

  return (
    <div className={cn("flex", isMe ? "justify-end" : "justify-start", nested && (isMe ? "pr-10" : "pl-10"))}>
      {/* Avatar sits flush at the bubble's very top-left corner, straddling
          the top edge — half above, half inside — mirroring the quote details
          Notes tab. mt-4 reserves room for the protruding half. */}
      <div className="relative mt-4 max-w-[75%]">
        <div className="absolute -top-4 left-0">
          <SenderAvatar name={note.authorName} imageUrl={note.authorImage} />
        </div>
        <div className={cn("rounded-2xl px-4 py-2.5 text-sm", colors.bubble)} data-testid={`ticket-note-${note.id}`}>
          {/* Only the header row is indented past the corner avatar — the
              message body below it runs the bubble's full width. */}
          <div className="mb-1 flex flex-wrap items-baseline gap-1 pl-6 text-xs">
            <span className={cn("font-semibold", colors.name)}>{note.authorName}</span>
            <span className="text-black/40 dark:text-white/40">
              – {formatNoteDate(note.createdAt)}
              {isEdited ? " (edited)" : ""}
            </span>
          </div>
          {actions?.isEditing ? (
            <NoteEditForm
              initial={note.content}
              onSave={actions.onSaveEdit}
              onCancel={actions.onCancelEdit}
              isSaving={actions.isSavingEdit}
            />
          ) : (
            <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed 3xl:text-sm">
              <RichTextDisplay content={note.content} />
            </div>
          )}
          {actions && !actions.isEditing && (
            <div className="mt-1.5 flex items-center gap-3 text-black/45 dark:text-white/40">
              {actions.isConfirmingDelete ? (
                <span className="flex items-center gap-1.5 text-[11px]">
                  Delete this reply?
                  <button
                    type="button"
                    onClick={actions.onConfirmDelete}
                    className="font-semibold text-rose-600 hover:underline"
                    data-testid={`ticket-note-delete-confirm-${note.id}`}
                  >
                    Yes
                  </button>
                  <button type="button" onClick={actions.onCancelDelete} className="font-semibold hover:underline">
                    No
                  </button>
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={actions.onLike}
                    disabled={actions.isLiking}
                    className={cn(
                      "flex items-center gap-1 text-[11px] font-medium transition hover:text-rose-500 disabled:opacity-60",
                      note.likedByMe && "text-rose-500",
                    )}
                    data-testid={`ticket-note-like-${note.id}`}
                  >
                    <Heart className={cn("h-3.5 w-3.5", note.likedByMe && "fill-current")} />
                    {note.likeCount > 0 ? note.likeCount : null}
                  </button>
                  <button
                    type="button"
                    onClick={actions.onReply}
                    className="flex items-center gap-1 text-[11px] font-medium transition hover:text-black dark:hover:text-white"
                    data-testid={`ticket-note-reply-${note.id}`}
                  >
                    <ReplyIcon className="h-3.5 w-3.5" /> Reply
                  </button>
                  {isMe && (
                    <>
                      <button
                        type="button"
                        onClick={actions.onEdit}
                        className="flex items-center gap-1 text-[11px] font-medium transition hover:text-black dark:hover:text-white"
                        data-testid={`ticket-note-edit-${note.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      {actions.canDelete && (
                      <button
                        type="button"
                        onClick={actions.onDelete}
                        className="flex items-center gap-1 text-[11px] font-medium transition hover:text-rose-600"
                        data-testid={`ticket-note-delete-${note.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Who a new reply is answering — shown as a banner above the composer. */
interface ReplyTarget {
  authorName: string;
  /** Top-level reply id the new reply nests under (none for the ticket itself). */
  parentReplyId?: string;
}

const COMPOSER_MAX_HEIGHT_PX = 140;

// Composer for a ticket's replies — visually matches the conversations inbox's
// Composer (rounded bordered box, auto-grow textarea, emoji + attach toolbar,
// outline "Send ⌄" button) minus the note/reply toggle: ticket replies have no
// note concept to switch to. Attachments aren't wired up here — see the
// "aren't supported" title below.
function ReplyComposer({
  ticketId,
  replyingTo,
  onCancelReplyTo,
  onSent,
}: {
  ticketId: string;
  replyingTo: ReplyTarget | null;
  onCancelReplyTo: () => void;
  onSent: () => void;
}) {
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const createReply = useCreateReply(ticketId);

  // Picking someone to reply to puts the cursor straight into the box.
  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus();
  }, [replyingTo]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || createReply.isPending) return;
    if (!currentUser?.id) {
      toast({ title: "Please wait while loading user data", variant: "destructive" });
      return;
    }
    createReply.mutate(
      { userId: currentUser.id, content: trimmed, parentReplyId: replyingTo?.parentReplyId },
      {
        onSuccess: () => {
          setText("");
          onSent();
        },
        onError: () => toast({ title: "Failed to add reply", variant: "destructive" }),
      },
    );
  };

  // Insert at the caret rather than appending, and hand focus back so typing
  // continues where the emoji landed — same pattern as the conversations
  // inbox's Composer.
  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      el?.focus();
      const caret = start + emoji.length;
      el?.setSelectionRange(caret, caret);
    });
  };

  // Auto-grow the composer up to a max height as the message spans more lines,
  // shrinking back down after send resets `text` — setText("") alone doesn't
  // fire onChange, so the height has to be driven off `text` itself rather than
  // set only inside the change handler (same pattern as the conversations
  // inbox's Composer).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
  }, [text]);

  return (
    <div className="flex-none border-t border-black/10 px-4 py-3 dark:border-white/10">
      {replyingTo && (
        <div
          className="mb-2 flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-1.5 text-xs text-sky-800 dark:bg-sky-500/10 dark:text-sky-300"
          data-testid="ticket-reply-replying-to"
        >
          <ReplyIcon className="h-3.5 w-3.5" />
          <span>
            Replying to <strong>{replyingTo.authorName}</strong>
          </span>
          <button
            type="button"
            onClick={onCancelReplyTo}
            className="ml-auto text-sky-600 hover:text-sky-800 dark:text-sky-400"
            aria-label="Cancel reply"
            data-testid="ticket-reply-cancel-reply-to"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="rounded-xl border border-black/10 bg-white px-4 pt-3 pb-2.5 dark:border-white/10 dark:bg-white/[0.03]">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Type a reply…"
          rows={2}
          spellCheck
          lang="en-GB"
          className="min-h-[56px] w-full resize-none border-0 bg-transparent px-0 py-1 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          data-testid="ticket-reply-composer-input"
        />

        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1 text-black/45 dark:text-white/45">
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-sm transition hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
                  title="Insert emoji"
                  data-testid="ticket-reply-emoji"
                >
                  <Smile className="h-4.5 w-4.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" side="top" className="w-72 p-2">
                <div className="max-h-[240px] space-y-2 overflow-y-auto" data-testid="ticket-reply-emoji-picker">
                  {EMOJI_CATEGORIES.map((cat) => (
                    <div key={cat.name}>
                      <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/40">
                        {cat.name}
                      </div>
                      <div className="grid grid-cols-8 gap-0.5">
                        {cat.emojis.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => insertEmoji(emoji)}
                            className="rounded-lg p-1 text-lg leading-none transition hover:bg-black/5 dark:hover:bg-white/10"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <button
              type="button"
              disabled
              title="Attachments aren't supported on ticket replies"
              className="grid h-8 w-8 place-items-center rounded-sm transition hover:bg-black/5 hover:text-black disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-white"
              data-testid="ticket-reply-attach"
            >
              <Paperclip className="h-4.5 w-4.5" />
            </button>
          </div>

          <Button
            type="button"
            onClick={submit}
            disabled={!text.trim() || createReply.isPending}
            variant="outline"
            className="h-10 shrink-0 gap-2 rounded-md border-black/10 bg-black/[0.02] px-4 text-sm font-medium text-black/60 hover:bg-black/5 hover:text-black disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/70"
            data-testid="ticket-reply-send"
          >
            {createReply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
            <span className="h-4 w-px bg-black/15 dark:bg-white/15" aria-hidden />
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// "23 Jul 2026" — short date for the link-booking select's label.
function formatBookingDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// "Link booking" dialog opened from the thread header's overflow menu — same
// client-bookings select as the create-ticket dialog's optional Booking field.
function LinkBookingDialog({ ticket, open, onOpenChange }: { ticket: Ticket; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [bookingId, setBookingId] = useState("");
  const updateTicket = useUpdateTicket();

  const { data: transactions } = useTransactions(
    { clientId: ticket.clientId ?? undefined },
    { enabled: open && !!ticket.clientId },
  );
  const bookings = (transactions ?? []).filter((t) => !!t.booking).map((t) => t.booking!);

  // Reseed from the ticket's current booking each time the dialog opens.
  useEffect(() => {
    if (open) setBookingId(ticket.bookingId ?? "");
  }, [open, ticket.bookingId]);

  const save = () => {
    if (!bookingId) return;
    updateTicket.mutate(
      { id: ticket.id, data: { bookingId } },
      {
        onSuccess: () => {
          toast({ title: "Booking linked" });
          onOpenChange(false);
        },
        onError: () => toast({ title: "Failed to link booking", variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Link booking</DialogTitle>
          <DialogDescription>Attach one of this client's bookings to the ticket.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Select value={bookingId || undefined} onValueChange={setBookingId}>
            <SelectTrigger data-testid="link-booking-select">
              <SelectValue placeholder={bookings.length ? "Select a booking" : "No bookings for this client"} />
            </SelectTrigger>
            <SelectContent>
              {bookings.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.title || "Untitled booking"}
                  {formatBookingDate(b.travel_date) ? ` — ${formatBookingDate(b.travel_date)}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="link-booking-cancel">
            Cancel
          </Button>
          <Button onClick={save} disabled={!bookingId || updateTicket.isPending} data-testid="link-booking-save">
            {updateTicket.isPending ? "Linking…" : "Link booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HeaderAction({ icon: Icon, label, onClick, disabled }: { icon: typeof Pin; label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-md border border-black/10 text-black/55 transition hover:bg-black/[0.03] hover:text-black disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/[0.04] dark:hover:text-white"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

interface TicketThreadPanelProps {
  ticket: Ticket | null;
  users: ApiUser[];
  onDeleted: () => void;
}

export function TicketThreadPanel({ ticket, users, onDeleted }: TicketThreadPanelProps) {
  const { toast } = useToast();
  const { data: replies, isLoading: repliesLoading } = useReplies(ticket?.id ?? "");
  const { data: currentUser } = useCurrentUser();
  const updateTicket = useUpdateTicket();
  const deleteTicket = useDeleteTicket();
  const [linkBookingOpen, setLinkBookingOpen] = useState(false);

  const ticketId = ticket?.id ?? "";
  const updateReply = useUpdateReply(ticketId);
  const deleteReply = useDeleteReply(ticketId);
  const toggleLike = useToggleReplyLike(ticketId);
  const toggleTicketLike = useToggleTicketLike();
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Per-reply UI state belongs to one ticket; drop it when another is opened.
  useEffect(() => {
    setReplyingTo(null);
    setEditingId(null);
    setConfirmDeleteId(null);
  }, [ticketId]);

  const thread = useMemo(() => (ticket ? buildThread(ticket, replies, users) : []), [ticket, replies, users]);
  const grouped = useMemo(() => groupByDay(thread), [thread]);
  const noteCount = (replies?.length ?? 0) + (ticket?.description ? 1 : 0);

  // Thread scroll container: opens at the newest note (bottom) and follows it
  // down again whenever the ticket changes or a new note lands — same pattern
  // as the conversations inbox's thread scroll effect.
  const threadScrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = threadScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [ticket?.id, noteCount]);

  const isMine = (userId: string) => !!currentUser?.id && currentUser.id === userId;

  // Builds the action handlers for one reply bubble. Replies to a nested reply
  // attach to its top-level parent (threads are one level deep) but still
  // name the person being answered.
  const actionsFor = (note: ThreadNote, topLevelId: string): NoteActions | undefined => {
    const reply = note.reply;
    if (!reply) {
      // The ticket description: likes and edits go through the ticket itself,
      // a reply to it is a top-level reply, and it is deleted from the menu.
      if (!ticket) return undefined;
      return {
        canDelete: false,
        onLike: () =>
          toggleTicketLike.mutate(ticket.id, {
            onError: () => toast({ title: "Failed to update like", variant: "destructive" }),
          }),
        isLiking: toggleTicketLike.isPending && toggleTicketLike.variables === ticket.id,
        onReply: () => setReplyingTo({ authorName: note.authorName }),
        onEdit: () => setEditingId(note.id),
        onDelete: () => undefined,
        isEditing: editingId === note.id,
        onSaveEdit: (content) =>
          updateTicket.mutate(
            { id: ticket.id, data: { description: content } },
            {
              onSuccess: () => setEditingId(null),
              onError: () => toast({ title: "Failed to update ticket", variant: "destructive" }),
            },
          ),
        onCancelEdit: () => setEditingId(null),
        isSavingEdit: updateTicket.isPending && updateTicket.variables?.id === ticket.id,
        isConfirmingDelete: false,
        onConfirmDelete: () => undefined,
        onCancelDelete: () => undefined,
      };
    }
    return {
      canDelete: true,
      onLike: () =>
        toggleLike.mutate(reply.id, {
          onError: () => toast({ title: "Failed to update like", variant: "destructive" }),
        }),
      isLiking: toggleLike.isPending && toggleLike.variables === reply.id,
      onReply: () => setReplyingTo({ authorName: note.authorName, parentReplyId: topLevelId }),
      onEdit: () => setEditingId(reply.id),
      onDelete: () => setConfirmDeleteId(reply.id),
      isEditing: editingId === reply.id,
      onSaveEdit: (content) =>
        updateReply.mutate(
          { id: reply.id, content },
          {
            onSuccess: () => setEditingId(null),
            onError: () => toast({ title: "Failed to update reply", variant: "destructive" }),
          },
        ),
      onCancelEdit: () => setEditingId(null),
      isSavingEdit: updateReply.isPending && updateReply.variables?.id === reply.id,
      isConfirmingDelete: confirmDeleteId === reply.id,
      onConfirmDelete: () =>
        deleteReply.mutate(reply.id, {
          onSuccess: () => setConfirmDeleteId(null),
          onError: () => toast({ title: "Failed to delete reply", variant: "destructive" }),
        }),
      onCancelDelete: () => setConfirmDeleteId(null),
    };
  };

  if (!ticket) {
    return (
      <Card className="flex flex-col overflow-hidden rounded-none border-0 bg-white p-0 shadow-none dark:bg-white/[0.04]">
        <div className="flex h-full flex-col items-center justify-center gap-3 text-black/30 dark:text-white/30">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-black/5 dark:bg-white/5">
            <LifeBuoy className="h-8 w-8" />
          </div>
          <div className="text-sm font-medium">Select a ticket</div>
          <div className="text-xs">Pick a ticket from the list to view its thread</div>
        </div>
      </Card>
    );
  }

  const setStatus = (status: string) =>
    updateTicket.mutate(
      { id: ticket.id, data: { status } },
      {
        onSuccess: () => toast({ title: `Status updated to ${status}` }),
        onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
      },
    );

  const reassign = (userId: string) =>
    updateTicket.mutate(
      { id: ticket.id, data: { assignedTo: userId } },
      {
        onSuccess: () => toast({ title: "Ticket reassigned" }),
        onError: () => toast({ title: "Failed to reassign ticket", variant: "destructive" }),
      },
    );

  const unlinkBooking = () =>
    updateTicket.mutate(
      { id: ticket.id, data: { bookingId: null } },
      {
        onSuccess: () => toast({ title: "Booking unlinked" }),
        onError: () => toast({ title: "Failed to unlink booking", variant: "destructive" }),
      },
    );

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this ticket?")) return;
    deleteTicket.mutate(ticket.id, {
      onSuccess: () => {
        toast({ title: "Ticket deleted" });
        onDeleted();
      },
      onError: () => toast({ title: "Failed to delete ticket", variant: "destructive" }),
    });
  };

  return (
    <Card className="flex flex-col overflow-hidden rounded-none border-0 bg-white p-0 shadow-none dark:bg-white/[0.04]">
      <div className="flex h-[76px] shrink-0 items-center justify-between gap-3 border-b border-black/10 px-6 dark:border-white/10">
        <div className="min-w-0">
          <span className="block truncate text-sm font-semibold 3xl:text-base" data-testid="ticket-thread-subject">
            {ticket.subject}
          </span>
          <div className="mt-1 flex items-center gap-1.5">
            <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold", typeChipClass(ticket.type))}>
              {ticket.type}
            </span>
            <span className="text-[11px] text-black/40 dark:text-white/40">{ticket.status}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <HeaderAction icon={Pin} label="Pin ticket (coming soon)" disabled />
          <HeaderAction
            icon={Link}
            label="Copy ticket link"
            onClick={() => {
              const url = `${window.location.origin}/tickets/${ticket.id}`;
              navigator.clipboard
                .writeText(url)
                .then(() => toast({ title: "Link copied", description: url }))
                .catch(() => toast({ title: "Couldn't copy link", variant: "destructive" }));
            }}
          />
          <HeaderAction icon={Share2} label="Share (coming soon)" disabled />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="grid h-10 w-10 place-items-center rounded-md text-black/55 transition hover:bg-black/[0.03] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.04] dark:hover:text-white"
                title="More actions"
                data-testid="ticket-thread-more"
              >
                <Ellipsis className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 rounded-xl">
              <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/40">
                Status
              </DropdownMenuLabel>
              {TICKET_STATUSES.map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn("gap-2 rounded-lg text-sm", ticket.status === s && "font-semibold")}
                  data-testid={`ticket-status-${s.toLowerCase().replace(" ", "-")}`}
                >
                  {s}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2 rounded-lg text-sm" data-testid="ticket-reassign">
                  <User className="h-4 w-4" /> Reassign
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-[50vh] overflow-y-auto rounded-xl">
                  {users.length === 0 ? (
                    <DropdownMenuItem disabled>No team members found</DropdownMenuItem>
                  ) : (
                    users.map((u) => (
                      <DropdownMenuItem key={u.id} onClick={() => reassign(u.id)} className="rounded-lg text-sm" data-testid={`ticket-reassign-${u.id}`}>
                        {u.name}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setLinkBookingOpen(true)}
                disabled={!ticket.clientId}
                className="gap-2 rounded-lg text-sm"
                data-testid="ticket-link-booking"
              >
                <Building2 className="h-4 w-4" /> Link booking
              </DropdownMenuItem>
              {ticket.bookingId && (
                <DropdownMenuItem
                  onClick={unlinkBooking}
                  className="gap-2 rounded-lg text-sm"
                  data-testid="ticket-unlink-booking"
                >
                  <Unlink className="h-4 w-4" /> Unlink booking
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                className="gap-2 rounded-lg text-sm text-red-600 focus:text-red-600 dark:text-red-400"
                data-testid="ticket-delete"
              >
                <Trash2 className="h-4 w-4" /> Delete ticket
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div ref={threadScrollRef} className="scrollbar-none flex-1 space-y-5 overflow-y-auto px-6 py-6">
        {repliesLoading && thread.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-black/30 dark:text-white/30">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-xs">Loading thread…</span>
          </div>
        ) : thread.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-black/40 dark:text-white/40">
            No activity on this ticket yet
          </div>
        ) : (
          grouped.map((group, gi) => (
            <div key={gi} className="space-y-4">
              <DayDivider label={group.day} />
              {group.items.map(({ note, children }) => (
                <div key={note.id} className="space-y-4">
                  <NoteBubble note={note} isMe={isMine(note.authorId)} actions={actionsFor(note, note.id)} />
                  {children.map((child) => (
                    <NoteBubble
                      key={child.id}
                      note={child}
                      nested
                      isMe={isMine(child.authorId)}
                      actions={actionsFor(child, note.id)}
                    />
                  ))}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <ReplyComposer
        key={ticket.id}
        ticketId={ticket.id}
        replyingTo={replyingTo}
        onCancelReplyTo={() => setReplyingTo(null)}
        onSent={() => setReplyingTo(null)}
      />

      <LinkBookingDialog ticket={ticket} open={linkBookingOpen} onOpenChange={setLinkBookingOpen} />
    </Card>
  );
}

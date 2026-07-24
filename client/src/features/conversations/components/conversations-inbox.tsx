import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  User,
  UserPlus,
  MessageSquare,
  Tag,
  StickyNote,
  Contact,
  X as XIcon,
  RefreshCw,
  Paperclip,
  Smile,
  Pen,
  Send,
  Bot,
  Languages,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cake,
  Globe,
  ArrowUpRight,
  Star,
  Lock,
  Inbox,
  Loader2,
  AlertCircle,
  RadioTower,
  Check,
  Mailbox,
  Phone,
  Mail,
  MapPin,
  CalendarDays,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useRole } from "@/hooks/use-role";
import { ChannelsDialog } from "./channels-dialog";
import { ClientLinkSection, contactLinkMatch, formatClientDate, composeClientAddress } from "./client-link-section";
import { GenerateEnquiryButton } from "./generate-enquiry-button";
import { AiStatusControl } from "./ai-status-control";
import { useContactLink } from "../api/use-contact-link";
import { CHANNELS } from "../channels";
import { toUiConversation, toUiMessage } from "../map";
import { useConversations, useConversationBadgeCounts } from "../api/use-conversations-queries";
import { useCloseConversation, useReopenConversation, useMarkConversationRead } from "../api/use-conversations-mutations";
import { useMessages, useSendMessage, useCreateInternalNote } from "../api/use-messages";
import { useConversationsRealtime } from "../api/use-conversations-realtime";
import { useInboxes } from "../api/use-inboxes";
import { messagesApi } from "../api/messages.api";
import type { SsInbox } from "../api/inboxes.api";
import type { Conversation, ConversationMessage, ConversationStatus, ConversationTag, MessageAttachment } from "../types";

// ─── Formatting ───────────────────────────────────────────────────────────────

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ─── Avatar with channel badge ────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const AVATAR_GRADIENTS = [
  "from-emerald-400 to-teal-600",
  "from-violet-400 to-purple-600",
  "from-amber-400 to-orange-600",
  "from-sky-400 to-blue-600",
  "from-pink-400 to-rose-600",
  "from-indigo-400 to-blue-700",
];

function gradientFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function ChannelAvatar({
  conversation,
  size = "md",
}: {
  conversation: Conversation;
  size?: "sm" | "md" | "lg";
}) {
  const meta = CHANNELS[conversation.channel];
  const Icon = meta.icon;
  const dims = size === "lg" ? "h-12 w-12 text-base" : size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";
  const badgeDims = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className="relative flex-shrink-0">
      <div
        className={cn(
          "rounded-full bg-gradient-to-br flex items-center justify-center font-semibold text-white",
          dims,
          gradientFor(conversation.contact.id),
        )}
      >
        {initials(conversation.contact.displayName)}
      </div>
      <span
        className={cn(
          "absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full ring-2 ring-white dark:ring-[#0b0b0f]",
          badgeDims,
          meta.badge,
        )}
        title={meta.label}
      >
        <Icon className="h-2.5 w-2.5" />
      </span>
    </div>
  );
}

// ─── Conversation list row ────────────────────────────────────────────────────

// A small coloured chip driven by the tag's own hex colour from the provider.
function TagChip({ tag }: { tag: ConversationTag }) {
  return (
    <span
      className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
      title={tag.name}
    >
      {tag.name}
    </span>
  );
}

function ConversationRow({
  conversation,
  active,
  onClick,
}: {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={`conversation-row-${conversation.id}`}
      className={cn(
        "flex w-full items-center gap-3 border-b border-black/5 px-4 py-3 text-left transition dark:border-white/5",
        active
          ? "bg-black/[0.06] dark:bg-white/[0.08]"
          : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
      )}
    >
      <ChannelAvatar conversation={conversation} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate text-sm",
              conversation.unread ? "font-bold text-black dark:text-white" : "font-semibold text-black/80 dark:text-white/80",
            )}
          >
            {conversation.contact.displayName}
          </span>
          <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
            {dayLabel(conversation.lastActivityAt)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1 text-xs text-black/55 dark:text-white/55">
            <ArrowUpRight className="h-3 w-3 flex-shrink-0 text-black/30 dark:text-white/30" />
            <span className="truncate">{conversation.preview}</span>
          </span>
          {conversation.assignee ? (
            <span className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black/45 dark:text-white/45 bg-black/[0.04] dark:bg-white/[0.06]">
              {conversation.assignee}
            </span>
          ) : (
            conversation.tags && conversation.tags.length > 0 && <TagChip tag={conversation.tags[0]} />
          )}
        </div>
      </div>
      {conversation.unread && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-sky-500" />}
    </button>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

// Renders one attachment. Images are fetched as a blob through the shared axios
// client (so auth + the app's configured base URL apply) and shown via an object
// URL — a raw <img src="/api/…"> would bypass that and break off-origin. The blob
// fetch is deferred until the image scrolls near the viewport (IntersectionObserver)
// so opening a long thread renders instantly instead of firing every image request
// at once. Non-image files fetch on click and open in a new tab.
function AttachmentView({ attachment }: { attachment: MessageAttachment }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [inView, setInView] = useState(false);
  const placeholderRef = useRef<HTMLDivElement | null>(null);

  // Start loading only when the placeholder is about to enter the viewport.
  useEffect(() => {
    if (!attachment.isImage || inView) return;
    const el = placeholderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" }, // prefetch just before it's visible
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [attachment.isImage, inView]);

  useEffect(() => {
    if (!attachment.isImage || !inView) return;
    let active = true;
    let created: string | null = null;
    messagesApi
      .attachmentBlob(attachment.id)
      .then((blob) => {
        if (!active) return;
        created = URL.createObjectURL(blob);
        setObjectUrl(created);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [attachment.id, attachment.isImage, inView]);

  if (attachment.isImage) {
    if (failed) {
      return (
        <div className="rounded-lg bg-black/5 px-2.5 py-1.5 text-xs text-black/50 dark:bg-white/10 dark:text-white/50">
          Couldn't load image
        </div>
      );
    }
    if (!objectUrl) {
      // Reserved box keeps layout stable and is the IntersectionObserver target.
      return <div ref={placeholderRef} className="h-40 w-40 animate-pulse rounded-lg bg-black/10 dark:bg-white/10" />;
    }
    return (
      <a href={objectUrl} target="_blank" rel="noopener noreferrer" className="block">
        <img src={objectUrl} alt={attachment.filename} className="max-h-64 max-w-full rounded-lg object-cover" />
      </a>
    );
  }

  const openFile = async () => {
    try {
      const blob = await messagesApi.attachmentBlob(attachment.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      /* ignore — the button simply does nothing on failure */
    }
  };
  return (
    <button
      type="button"
      onClick={openFile}
      className="flex items-center gap-2 rounded-lg bg-black/5 px-2.5 py-1.5 text-xs font-medium hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
    >
      <Paperclip className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="truncate">{attachment.filename}</span>
    </button>
  );
}

function MessageBubble({ message, conversation }: { message: ConversationMessage; conversation: Conversation }) {
  const outbound = message.direction === "outbound";
  const meta = CHANNELS[conversation.channel];
  const ChannelIcon = meta.icon;

  // Internal notes are teammate-only — render as a centered amber sticky note.
  if (message.isNote) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[80%] rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
          <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600/80 dark:text-amber-300/80">
            <StickyNote className="h-3 w-3" /> Internal note · {clockTime(message.sentAt)}
          </div>
          <p className="whitespace-pre-wrap">{message.body}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-end gap-2", outbound ? "justify-end" : "justify-start")}>
      {!outbound && (
        <div className={cn("grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br text-[11px] font-semibold text-white", gradientFor(conversation.contact.id))}>
          {initials(conversation.contact.displayName)}
        </div>
      )}
      <div className={cn("max-w-[70%]", outbound && "flex flex-col items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
            outbound
              ? "rounded-br-md bg-[#dcf37a] text-black dark:bg-[#c7e85f]/90"
              : "rounded-bl-md bg-white text-black/85 ring-1 ring-black/5 dark:bg-white/[0.08] dark:text-white/90 dark:ring-white/10",
          )}
        >
          {message.body && <p className="whitespace-pre-wrap">{message.body}</p>}
          {message.attachments && message.attachments.length > 0 && (
            <div className={cn("flex flex-col gap-1.5", message.body && "mt-2")}>
              {message.attachments.map((a) => (
                <AttachmentView key={a.id} attachment={a} />
              ))}
            </div>
          )}
          {message.cta && (
            <>
              <div className="my-2 h-px bg-black/10" />
              <div className="text-center text-sm font-semibold text-black">{message.cta.label}</div>
            </>
          )}
        </div>
        <span className="mt-1 px-1 text-[10px] text-black/40 dark:text-white/40">{clockTime(message.sentAt)}</span>
      </div>
      {outbound && (
        <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-emerald-500/90 text-[11px] font-semibold text-white">
          <ChannelIcon className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}

// ─── Contact detail panel ─────────────────────────────────────────────────────

function DetailField({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof User }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/40">{label}</div>
      <div className="flex items-center gap-2 text-sm text-black/80 dark:text-white/80">
        {Icon && <Icon className="h-3.5 w-3.5 text-black/35 dark:text-white/35" />}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

function ContactPanel({ conversation }: { conversation: Conversation }) {
  const { contact } = conversation;
  const meta = CHANNELS[conversation.channel];
  const ChannelIcon = meta.icon;

  // Shares the cached contact-link query with ClientLinkSection (keyed by contact
  // id). When linked, Master Data shows the CRM client's record instead of the
  // raw SendSeven contact fields.
  const { data: link } = useContactLink(conversation.contact.id, contactLinkMatch(conversation));
  const client = link?.linkedClient ?? null;

  return (
    <Card className="glass ringed grain flex flex-col overflow-hidden rounded-3xl p-0">
      <div className="flex items-center justify-between border-b border-black/8 px-4 py-3 dark:border-white/8">
        <div className="flex min-w-0 items-center gap-2.5">
          <ChannelAvatar conversation={conversation} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{contact.displayName}</div>
            <div className="truncate text-[11px] text-black/40 dark:text-white/40">{contact.id}</div>
          </div>
        </div>
        <button className="flex items-center gap-1 text-xs font-medium text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white">
          <ArrowUpRight className="h-3.5 w-3.5" /> Profile
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <ClientLinkSection conversation={conversation} />

        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-black/35 dark:text-white/35">
          Master Data
          {client && <span className="font-semibold normal-case text-green-600 dark:text-green-400">· from your CRM</span>}
        </div>
        {client ? (
          <>
            <DetailField
              label="Name"
              value={[client.title, client.firstName, client.surename].filter(Boolean).join(" ")}
              icon={User}
            />
            {client.phoneNumber && <DetailField label="Phone" value={client.phoneNumber} icon={Phone} />}
            {client.email && <DetailField label="Email" value={client.email} icon={Mail} />}
            {formatClientDate(client.DOB) && <DetailField label="Date of birth" value={formatClientDate(client.DOB)!} icon={Cake} />}
            {composeClientAddress(client) && <DetailField label="Address" value={composeClientAddress(client)!} icon={MapPin} />}
            {client.badge && <DetailField label="Badge" value={client.badge} icon={Star} />}
            {formatClientDate(client.createdAt) && (
              <DetailField label="Client since" value={formatClientDate(client.createdAt)!} icon={CalendarDays} />
            )}
          </>
        ) : (
          <>
            <DetailField label="Display name" value={contact.displayName} icon={User} />
            <DetailField label="First name" value={contact.firstName} icon={User} />
            <DetailField label="Last name" value={contact.lastName} icon={User} />
            <DetailField label="Languages" value={contact.languages.join(", ")} icon={Globe} />
            {contact.birthday && (
              <DetailField
                label="Birthday"
                value={new Date(contact.birthday).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                icon={Cake}
              />
            )}
          </>
        )}

        <div className="pt-1 text-[10px] font-bold uppercase tracking-wider text-black/35 dark:text-white/35">
          Contact Channels
        </div>
        <div className="rounded-2xl border border-black/8 p-3 dark:border-white/8">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/40">
            {contact.handleLabel}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className={cn("grid h-6 w-6 place-items-center rounded-full", meta.badge)}>
                <ChannelIcon className="h-3 w-3" />
              </span>
              <span className="truncate text-sm text-black/80 dark:text-white/80">{contact.handle}</span>
            </div>
            <span className="flex flex-shrink-0 items-center gap-1 rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[10px] text-black/50 dark:bg-white/[0.06] dark:text-white/50">
              <Lock className="h-2.5 w-2.5" /> Read-only
            </span>
          </div>
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-[#dcf37a] px-2 py-0.5 text-[10px] font-bold text-black">
              <Star className="h-2.5 w-2.5 fill-black" /> PRIMARY
            </span>
          </div>
        </div>
        <button className="w-full rounded-xl border border-dashed border-black/15 py-2 text-xs font-medium text-black/50 transition hover:border-black/25 hover:text-black/70 dark:border-white/15 dark:text-white/50 dark:hover:text-white/70">
          + Add contact channel
        </button>

        {contact.customFields.length > 0 && (
          <>
            <div className="pt-1 text-[10px] font-bold uppercase tracking-wider text-black/35 dark:text-white/35">
              Custom Fields
            </div>
            {contact.customFields.map((f) => (
              <DetailField key={f.label} label={f.label} value={f.value} />
            ))}
          </>
        )}
      </div>
    </Card>
  );
}

// ─── Composer ─────────────────────────────────────────────────────────────────

const COMPOSER_MAX_HEIGHT_PX = 120;

function Composer({ onSend, sending, conversation }: { onSend: (body: string, mode: "reply" | "note") => void; sending?: boolean; conversation: Conversation }) {
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed, mode);
    setText("");
  };

  // Auto-grow the composer up to a max height as the message spans more lines,
  // shrinking back down (e.g. after send resets `text`).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
  }, [text]);

  return (
    <div className="border-t border-black/8 px-4 py-3 dark:border-white/8">
      <div className="mb-2 flex items-center justify-end gap-2">
        <button className="flex items-center gap-1.5 rounded-full bg-[#dcf37a] px-3 py-1.5 text-xs font-semibold text-black">
          <Bot className="h-3.5 w-3.5" /> Router-Bot <ChevronDown className="h-3 w-3" />
        </button>
        <GenerateEnquiryButton conversation={conversation} />
        <button className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/5">
          <Languages className="h-3.5 w-3.5" /> Translate
        </button>
      </div>

      <div className="mb-2 flex items-center gap-4">
        {(["reply", "note"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "rounded-lg px-3 py-1 text-sm font-semibold capitalize transition",
              mode === m
                ? m === "reply"
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-amber-400/20 text-amber-700 dark:text-amber-300"
                : "text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      <div
        className={cn(
          "flex items-end gap-2 rounded-2xl border px-3 py-2",
          mode === "note"
            ? "border-amber-400/40 bg-amber-400/5"
            : "border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03]",
        )}
      >
        <button className="mb-1 text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white">
          <Paperclip className="h-4 w-4" />
        </button>
        <button className="mb-1 text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white">
          <Pen className="h-4 w-4" />
        </button>
        <button className="mb-1 text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white">
          <Smile className="h-4 w-4" />
        </button>
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
          placeholder={mode === "note" ? "Add an internal note…" : "Type a message… (/ for commands, @ to assign)"}
          rows={1}
          className="min-h-0 flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          data-testid="conversation-composer-input"
        />
        <Button
          onClick={submit}
          disabled={!text.trim() || sending}
          size="icon"
          className="mb-1 h-9 w-9 flex-shrink-0 rounded-xl bg-black text-white hover:bg-black/85 disabled:opacity-40 dark:bg-white dark:text-black"
          data-testid="conversation-send"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// ─── Thread header action button ──────────────────────────────────────────────

function HeaderAction({ icon: Icon, label, onClick }: { icon: typeof User; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-xl border border-black/8 px-3 py-1.5 text-xs font-medium text-black/70 transition hover:bg-black/[0.03] dark:border-white/8 dark:text-white/70 dark:hover:bg-white/[0.04]"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// Inbox icon: the inbox's emoji if it has one, else a dot in its colour;
// null = "All Messages".
function InboxDot({ inbox }: { inbox: SsInbox | null }) {
  if (!inbox) return <Mailbox className="h-4 w-4 text-black/50 dark:text-white/50" />;
  if (inbox.icon && /\p{Extended_Pictographic}/u.test(inbox.icon)) {
    return <span className="text-sm leading-none">{inbox.icon}</span>;
  }
  return <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: inbox.color || "#94a3b8" }} />;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

// Client-side overlay for the interactions the messages/send endpoints don't
// cover yet (list-only scope): locally-sent replies and open/close toggles.
// Keyed by conversation id; merged onto the server data below.
type Overlay = Record<string, { extraMessages: ConversationMessage[]; status?: ConversationStatus }>;

export default function ConversationsInbox() {
  const [tab, setTab] = useState<ConversationStatus>("open");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>({});
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [inboxId, setInboxId] = useState<string | null>(null); // null = All Messages
  // Conversation id → ISO timestamp of when the user last opened it. Clears the
  // unread dot locally the instant a conversation is opened, without waiting on
  // (or depending on) SendSeven accepting the mark-read PATCH.
  const [seenAt, setSeenAt] = useState<Record<string, string>>({});

  const { orgRole } = useRole();
  const canManageChannels = orgRole === "org_admin" || orgRole === "branch_manager" || orgRole === "platform_admin";

  // One shared SSE connection for the whole inbox — maps server events to
  // targeted query invalidations (new messages, AI state, assignment, etc).
  const { connected: realtimeConnected } = useConversationsRealtime();

  // Custom inboxes (saved views) from SendSeven — drive the inbox switcher.
  const { data: inboxesData } = useInboxes();
  const inboxList = useMemo(
    () =>
      (inboxesData?.items ?? [])
        .filter((i) => i.is_active !== false)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [inboxesData],
  );

  const { data, isLoading, isFetching, isError, refetch } = useConversations({
    status: tab,
    page,
    pageSize: PAGE_SIZE,
    inboxId: inboxId ?? undefined,
  });
  const { data: badges } = useConversationBadgeCounts();
  const closeMutation = useCloseConversation();
  const reopenMutation = useReopenConversation();
  const markReadMutation = useMarkConversationRead();

  const pagination = data?.pagination;

  // Reset to the first page whenever the tab or selected inbox changes.
  useEffect(() => {
    setPage(1);
  }, [tab, inboxId]);

  // Server items → UI model, then merge the local overlay.
  const conversations = useMemo(() => {
    const base = (data?.items ?? []).map(toUiConversation);
    return base.map((c) => {
      const o = overlay[c.id];
      const merged = o
        ? {
            ...c,
            status: o.status ?? c.status,
            messages: [...c.messages, ...o.extraMessages],
            preview: o.extraMessages.length > 0 ? o.extraMessages[o.extraMessages.length - 1].body : c.preview,
            lastActivityAt: o.extraMessages.length > 0 ? o.extraMessages[o.extraMessages.length - 1].sentAt : c.lastActivityAt,
            unread: o.extraMessages.length > 0 ? false : c.unread,
          }
        : c;
      // A conversation only renders as unread if it hasn't been seen since its
      // last activity — clears the dot instantly on open, and re-lights it if a
      // newer message arrives after the user viewed the thread.
      const seen = seenAt[merged.id];
      const unread = merged.unread && (!seen || Date.parse(merged.lastActivityAt) > Date.parse(seen));
      return { ...merged, unread };
    });
  }, [data, overlay, seenAt]);

  // Conversations are filtered server-side by inbox_id (see useConversations);
  // here we only apply the local search + status.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations
      .filter((c) => c.status === tab)
      .filter((c) => !q || c.contact.displayName.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
  }, [conversations, tab, search]);

  const activeInbox = inboxId ? (inboxList.find((i) => i.id === inboxId) ?? null) : null;

  // Keep a valid selection: if the current pick fell out of the list, select the first.
  useEffect(() => {
    if (filtered.length === 0) {
      if (selectedId !== null) setSelectedId(null);
    } else if (!filtered.some((c) => c.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  // Stamp "seen" the moment a conversation is opened (covers both the row
  // onClick and any auto-selection path above) so the unread dot clears
  // instantly. Also best-effort tells SendSeven the conversation was read —
  // `selected.unread` here still reflects the pre-stamp state since `seenAt`
  // hasn't been updated yet this render.
  // Re-runs when the open conversation's lastActivityAt moves too, so a message
  // arriving while the thread is on screen doesn't re-light its unread dot.
  useEffect(() => {
    if (!selectedId) return;
    const wasUnread = selected?.unread ?? false;
    setSeenAt((prev) => ({ ...prev, [selectedId]: new Date().toISOString() }));
    if (wasUnread) {
      markReadMutation.mutate(selectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selected?.lastActivityAt]);

  // Real thread for the selected conversation (the list only carries the
  // last_message). Falls back to that seed while the messages query loads.
  const { data: messagesData, isLoading: messagesLoading } = useMessages(selectedId);
  const sendMessage = useSendMessage(selectedId ?? undefined);
  const createNote = useCreateInternalNote(selectedId ?? undefined);

  const optimistic = selectedId ? (overlay[selectedId]?.extraMessages ?? []) : [];

  const threadMessages = useMemo(() => {
    const base = messagesData ? messagesData.items.map(toUiMessage) : (selected?.messages ?? []);
    const baseIds = new Set(base.map((m) => m.id));
    const merged = [...base, ...optimistic.filter((m) => !baseIds.has(m.id))];
    return merged.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  }, [messagesData, selected, optimistic]);

  const clearOptimistic = (convId: string) =>
    setOverlay((prev) => {
      const cur = prev[convId];
      if (!cur) return prev;
      return { ...prev, [convId]: { ...cur, extraMessages: [] } };
    });

  const handleSend = (body: string, mode: "reply" | "note") => {
    if (!selected) return;
    const convId = selected.id;
    // Optimistic bubble for instant feedback…
    const optimisticMsg: ConversationMessage = {
      id: `opt-${convId}-${new Date().getTime()}`,
      direction: "outbound",
      body,
      sentAt: new Date().toISOString(),
      authorName: "You",
      read: false,
      isNote: mode === "note",
    };
    setOverlay((prev) => {
      const cur = prev[convId] ?? { extraMessages: [] };
      return { ...prev, [convId]: { ...cur, extraMessages: [...cur.extraMessages, optimisticMsg] } };
    });
    // …then persist via the real SendSeven message endpoint; on success the
    // messages query refetches and we drop the optimistic copy to avoid dupes.
    const opts = { onSuccess: () => clearOptimistic(convId) };
    if (mode === "note") createNote.mutate({ conversation_id: convId, text: body }, opts);
    else sendMessage.mutate({ conversation_id: convId, message_type: "text", text: body }, opts);
  };

  const closeTicket = () => {
    if (!selected) return;
    const wasOpen = selected.status === "open";
    const nextStatus: ConversationStatus = wasOpen ? "closed" : "open";
    // Optimistic overlay for instant feedback…
    setOverlay((prev) => {
      const cur = prev[selected.id] ?? { extraMessages: [] };
      return { ...prev, [selected.id]: { ...cur, status: nextStatus } };
    });
    // …then persist via the real SendSeven close/reopen endpoint (the mutation
    // invalidates the list so the server state reconciles on refetch).
    if (wasOpen) closeMutation.mutate({ id: selected.id, body: { summarize: false } });
    else reopenMutation.mutate(selected.id);
  };

  // Group the thread's messages by day for the date dividers.
  const grouped = useMemo(() => {
    if (!selected) return [];
    const out: { day: string; messages: ConversationMessage[] }[] = [];
    for (const m of threadMessages) {
      const label = `${dayLabel(m.sentAt)}, ${clockTime(m.sentAt)}`;
      const key = dayLabel(m.sentAt);
      const last = out[out.length - 1];
      if (last && last.day.startsWith(key)) last.messages.push(m);
      else out.push({ day: label, messages: [m] });
    }
    return out;
  }, [selected, threadMessages]);

  // Thread scroll container: opens at the newest message (bottom) instead of
  // the top, and stays pinned to the bottom as new messages arrive while the
  // user is already near it — without yanking them away if they've scrolled
  // up to read history.
  const threadScrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const lastScrolledIdRef = useRef<string | null>(null);

  const handleThreadScroll = () => {
    const el = threadScrollRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  useLayoutEffect(() => {
    const el = threadScrollRef.current;
    if (!el) return;
    const firstLoadForConversation = lastScrolledIdRef.current !== selectedId;
    if (firstLoadForConversation || nearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      nearBottomRef.current = true;
    }
    if (firstLoadForConversation) lastScrolledIdRef.current = selectedId;
  }, [selectedId, threadMessages.length]);

  return (
    <section
      className="grid h-[calc(100vh-8rem)] gap-4"
      style={{ gridTemplateColumns: "320px 1fr 300px" }}
      data-testid="section-conversations"
    >
      {/* ── Conversation list ── */}
      <Card className="glass ringed grain flex flex-col overflow-hidden rounded-3xl p-0">
        <div className="flex items-center gap-1.5 border-b border-black/8 px-3 py-2.5 dark:border-white/8">
          <button className="grid h-8 w-8 place-items-center rounded-full text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/5">
            <Search className="h-4 w-4" />
          </button>
          <button className="grid h-8 w-8 place-items-center rounded-full text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/5">
            <User className="h-4 w-4" />
          </button>
          <button className="grid h-8 w-8 place-items-center rounded-full text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/5">
            <UserPlus className="h-4 w-4" />
          </button>
          <button className="relative grid h-8 w-8 place-items-center rounded-full text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/5">
            <MessageSquare className="h-4 w-4" />
            {badges && badges.total_unanswered > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-[#0b0b0f]">
                {badges.total_unanswered > 99 ? "99+" : badges.total_unanswered}
              </span>
            )}
          </button>
          <div className="flex-1" />
          <span
            className={cn(
              "h-2 w-2 flex-shrink-0 rounded-full transition-colors",
              realtimeConnected ? "bg-emerald-500" : "bg-black/15 dark:bg-white/15",
            )}
            title={realtimeConnected ? "Live" : "Reconnecting…"}
            data-testid="conversation-realtime-indicator"
          />
          {canManageChannels && (
            <button
              onClick={() => setChannelsOpen(true)}
              title="Channels"
              className="grid h-8 w-8 place-items-center rounded-full text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/5"
              data-testid="conversation-channels-button"
            >
              <RadioTower className="h-4 w-4" />
            </button>
          )}
          <button className="grid h-8 w-8 place-items-center rounded-full bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Inbox switcher: All Messages + custom inboxes from SendSeven */}
        <div className="px-3 pt-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex w-full items-center justify-between rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-sm font-semibold transition hover:bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                data-testid="conversation-inbox-switcher"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <InboxDot inbox={activeInbox} />
                  <span className="truncate">{activeInbox?.name ?? "All Messages"}</span>
                </span>
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-black/40 dark:text-white/40" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[60vh] w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto rounded-xl">
              <DropdownMenuItem
                onClick={() => setInboxId(null)}
                className="flex items-center justify-between gap-2 rounded-lg text-sm"
                data-testid="inbox-option-all"
              >
                <span className="flex items-center gap-2">
                  <Mailbox className="h-4 w-4 text-black/50 dark:text-white/50" /> All Messages
                </span>
                {inboxId === null && <Check className="h-3.5 w-3.5" />}
              </DropdownMenuItem>
              {inboxList.length > 0 && <DropdownMenuSeparator />}
              {inboxList.map((ib) => (
                <DropdownMenuItem
                  key={ib.id}
                  onClick={() => setInboxId(ib.id)}
                  className="flex items-center justify-between gap-2 rounded-lg text-sm"
                  data-testid={`inbox-option-${ib.id}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <InboxDot inbox={ib} />
                    <span className="truncate">{ib.name}</span>
                  </span>
                  {inboxId === ib.id && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="px-3 pt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/40 dark:text-white/40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="h-8 rounded-xl border-black/10 bg-black/[0.03] pl-9 text-xs dark:border-white/10 dark:bg-white/[0.04]"
              data-testid="conversation-search"
            />
          </div>
        </div>

        <div className="flex items-center gap-6 border-b border-black/8 px-4 pt-3 dark:border-white/8">
          {(["open", "closed"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "relative pb-2 text-xs font-bold uppercase tracking-wide transition",
                tab === t ? "text-black dark:text-white" : "text-black/40 hover:text-black/60 dark:text-white/40",
              )}
            >
              {t}
              {tab === t && pagination && pagination.total > 0 && (
                <span className="ml-1 text-black/40 dark:text-white/40">{pagination.total}</span>
              )}
              {tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-black dark:bg-white" />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-black/30 dark:text-white/30">
              <Loader2 className="h-7 w-7 animate-spin" />
              <span className="text-xs">Loading conversations…</span>
            </div>
          ) : isError ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center text-black/40 dark:text-white/40">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <span className="text-sm font-medium">Couldn't load conversations</span>
              <span className="text-xs">The conversations service is unreachable or not configured.</span>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-1 h-8 rounded-xl text-xs">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-black/30 dark:text-white/30">
              <Inbox className="h-9 w-9" />
              <span className="text-sm">No {tab} conversations</span>
            </div>
          ) : (
            filtered.map((c) => (
              <ConversationRow key={c.id} conversation={c} active={c.id === selectedId} onClick={() => setSelectedId(c.id)} />
            ))
          )}
        </div>

        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between border-t border-black/8 px-4 py-2 dark:border-white/8">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!pagination.has_prev || page <= 1 || isFetching}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-black/10 px-2 text-xs font-medium text-black/70 transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5"
              data-testid="conversations-prev-page"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <span className="text-xs text-black/50 dark:text-white/50">
              Page {pagination.page} of {pagination.total_pages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.has_next || page >= pagination.total_pages || isFetching}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-black/10 px-2 text-xs font-medium text-black/70 transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5"
              data-testid="conversations-next-page"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </Card>

      {/* ── Thread ── */}
      <Card className="glass ringed grain flex flex-col overflow-hidden rounded-3xl p-0">
        {selected ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 px-5 py-3 dark:border-white/8">
              <div className="flex min-w-0 items-center gap-3">
                <ChannelAvatar conversation={selected} size="sm" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-base font-bold">{selected.contact.displayName}</span>
                  </div>
                  <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", CHANNELS[selected.channel].chip)}>
                    {selected.assignee ?? CHANNELS[selected.channel].label}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <AiStatusControl conversationId={selected.id} />
                <HeaderAction icon={RefreshCw} label="Switch channel" />
                <HeaderAction icon={StickyNote} label="Notes" />
                <HeaderAction icon={Contact} label="Contact info" />
                <HeaderAction icon={XIcon} label={selected.status === "open" ? "Close ticket" : "Reopen"} onClick={closeTicket} />
                <HeaderAction icon={UserPlus} label="Assign" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-black/8 px-5 py-2 dark:border-white/8">
              {selected.tags?.map((t) => (
                <TagChip key={t.id} tag={t} />
              ))}
              <button className="flex items-center gap-1.5 text-xs font-medium text-black/45 hover:text-black/70 dark:text-white/45 dark:hover:text-white/70">
                <Tag className="h-3.5 w-3.5" /> Add tag
              </button>
            </div>

            <div
              ref={threadScrollRef}
              onScroll={handleThreadScroll}
              className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
            >
              {messagesLoading && threadMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-black/30 dark:text-white/30">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-xs">Loading messages…</span>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {grouped.map((group, gi) => (
                    <motion.div
                      key={gi}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div className="flex justify-center">
                        <span className="rounded-full bg-black/[0.04] px-3 py-1 text-[10px] font-medium text-black/40 dark:bg-white/[0.06] dark:text-white/40">
                          {group.day}
                        </span>
                      </div>
                      {group.messages.map((m) => (
                        <MessageBubble key={m.id} message={m} conversation={selected} />
                      ))}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            <Composer onSend={handleSend} sending={sendMessage.isPending || createNote.isPending} conversation={selected} />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-black/30 dark:text-white/30">
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-black/5 dark:bg-white/5">
              <MessageSquare className="h-8 w-8" />
            </div>
            <div className="text-sm font-medium">Select a conversation</div>
            <div className="text-xs">Pick a thread from any channel to reply</div>
          </div>
        )}
      </Card>

      {/* ── Contact panel ── */}
      {selected ? (
        <ContactPanel conversation={selected} />
      ) : (
        <Card className="glass ringed grain hidden rounded-3xl xl:block" />
      )}

      {canManageChannels && <ChannelsDialog open={channelsOpen} onOpenChange={setChannelsOpen} />}
    </section>
  );
}

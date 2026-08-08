import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  User,
  UserPlus,
  MessageSquare,
  Tag,
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
  AlarmClock,
  AlarmClockOff,
  AlertCircle,
  RadioTower,
  Check,
  Mailbox,
  Phone,
  Mail,
  MapPin,
  CalendarDays,
  FlaskConical,
  Sparkles,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { EMOJI_CATEGORIES } from "@/lib/emoji";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/use-role";
import { ChannelsDialog } from "./channels-dialog";
import { ClientLinkSection, contactLinkMatch, formatClientDate, composeClientAddress } from "./client-link-section";
import { GenerateEnquiryButton } from "./generate-enquiry-button";
import { AiStatusControl } from "./ai-status-control";
import { TestAiModal } from "./test-ai-modal";
import {
  DayDivider,
  MessageBubble,
  dayLabel,
  gradientFor,
  groupMessagesByDay,
  initials,
} from "./message-thread";
import { useContactLink } from "../api/use-contact-link";
import { CHANNELS } from "../channels";
import { toUiConversation, toUiMessage } from "../map";
import { conversationsKeys, useConversations, useConversationBadgeCounts, unreadBadgeCount } from "../api/use-conversations-queries";
import {
  useAiSuggestReply,
  useMarkConversationRead,
  useSnoozeConversation,
  useUnsnoozeConversation,
} from "../api/use-conversations-mutations";
import { useMessages, useSendMessage, useCreateInternalNote, useUploadAttachment } from "../api/use-messages";
import { MAX_ATTACHMENT_BYTES, messageTypeForContentType } from "../api/messages.api";
import { useConversationsRealtimeState } from "./conversations-realtime-provider";
import { useInboxes } from "../api/use-inboxes";
import type { SsInbox } from "../api/inboxes.api";
import type { Conversation, ConversationMessage, ConversationTag, InboxTab } from "../types";

// ─── Avatar with channel badge ────────────────────────────────────────────────

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
  draftPreview,
}: {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
  // Unsent text left behind in this thread's composer. Takes over the preview
  // line while it's set — see draftTags for when it clears.
  draftPreview?: string;
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
          {draftPreview ? (
            <span className="flex min-w-0 items-center gap-1.5 text-xs" data-testid={`conversation-draft-${conversation.id}`}>
              <span className="flex-shrink-0 rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Draft
              </span>
              <span className="truncate text-black/55 dark:text-white/55">{draftPreview}</span>
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-1 text-xs text-black/55 dark:text-white/55">
              <ArrowUpRight className="h-3 w-3 flex-shrink-0 text-black/30 dark:text-white/30" />
              <span className="truncate">{conversation.preview}</span>
            </span>
          )}
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

// A file the user has picked. Uploaded to SendSeven as soon as it's chosen, so
// the id is ready by the time they hit send (see docs.sendseven.com two-phase
// attachment flow: upload → id → reference the id on the message).
interface PendingAttachment {
  key: string;
  file: File;
  status: "uploading" | "ready" | "error";
  id?: string;
  // MIME type as validated by SendSeven at upload (magic-byte checked), which
  // decides the message_type of the send; file.type is only the fallback.
  contentType?: string;
  error?: string;
}

export interface ComposerAttachments {
  ids: string[];
  filenames: string[];
  contentTypes: string[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Unsent composer content, stashed per conversation while the user is elsewhere.
// The mode rides along with the text: a half-written internal note must not come
// back as a customer reply.
export interface ComposerDraft {
  text: string;
  mode: "reply" | "note";
}

function Composer({
  onSend,
  sending,
  conversation,
  draft,
  onDraftChange,
}: {
  onSend: (body: string, mode: "reply" | "note", attachments?: ComposerAttachments) => void;
  sending?: boolean;
  conversation: Conversation;
  draft?: ComposerDraft;
  onDraftChange?: (conversationId: string, draft: ComposerDraft) => void;
}) {
  // Seeded once per mount — the caller keys this component by conversation id,
  // so switching threads remounts it with that thread's own draft.
  const [mode, setMode] = useState<"reply" | "note">(draft?.mode ?? "reply");
  const [text, setText] = useState(draft?.text ?? "");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAttachment = useUploadAttachment();
  const aiSuggest = useAiSuggestReply();
  const { toast } = useToast();

  // "AI reply": fetch a one-off suggestion (server-side it's read-only — no
  // state changes, nothing sent) and drop it into the reply box for the agent
  // to edit and send themselves.
  const suggestReply = () => {
    if (aiSuggest.isPending) return;
    aiSuggest.mutate(conversation.id, {
      onSuccess: ({ suggestion }) => {
        setMode("reply");
        setText(suggestion);
        requestAnimationFrame(() => textareaRef.current?.focus());
      },
      onError: (err) =>
        toast({ title: "Couldn't generate a reply", description: (err as Error).message, variant: "destructive" }),
    });
  };

  const uploading = attachments.some((a) => a.status === "uploading");
  const ready = attachments.filter((a) => a.status === "ready" && a.id);
  // Internal notes are text-only in SendSeven's API — there's no attachments
  // field on the internal-notes endpoint — so the picker is disabled in note mode.
  const canAttach = mode === "reply";

  const pickFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast({
          title: "File too large",
          description: `${file.name} is ${formatBytes(file.size)} — the limit is 50MB.`,
          variant: "destructive",
        });
        continue;
      }
      const key = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`;
      setAttachments((prev) => [...prev, { key, file, status: "uploading" }]);
      uploadAttachment.mutate(file, {
        onSuccess: (uploaded) =>
          setAttachments((prev) =>
            prev.map((a) =>
              a.key === key ? { ...a, status: "ready", id: uploaded.id, contentType: uploaded.content_type } : a,
            ),
          ),
        onError: (err: Error) =>
          setAttachments((prev) =>
            prev.map((a) => (a.key === key ? { ...a, status: "error", error: err.message } : a)),
          ),
      });
    }
  };

  const removeAttachment = (key: string) => setAttachments((prev) => prev.filter((a) => a.key !== key));

  // Insert at the caret rather than appending, and hand focus back so typing
  // continues where the emoji landed.
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

  const submit = () => {
    const trimmed = text.trim();
    // An attachment on its own is a valid message; text is only required when
    // there's nothing else to send. Never send mid-upload — the ids aren't in yet.
    if (uploading) return;
    if (!trimmed && ready.length === 0) return;
    onSend(
      trimmed,
      mode,
      ready.length > 0
        ? {
            ids: ready.map((a) => a.id as string),
            filenames: ready.map((a) => a.file.name),
            contentTypes: ready.map((a) => a.contentType ?? a.file.type),
          }
        : undefined,
    );
    setText("");
    setAttachments([]);
  };

  // Report every edit up so it survives this component being unmounted on a
  // conversation switch. Covers all the paths that touch `text` — typing, emoji
  // insert, AI suggest, and the clear on send (which stores an empty draft, i.e.
  // discards it).
  //
  // The mount pass is deliberately skipped: seeding the box from a saved draft
  // is not the user editing it, and merely opening a thread must not count as
  // resuming work on the draft (which is what retires the list's Draft tag).
  const restored = useRef(false);
  useEffect(() => {
    if (!restored.current) {
      restored.current = true;
      return;
    }
    onDraftChange?.(conversation.id, { text, mode });
  }, [text, mode, conversation.id, onDraftChange]);

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
        <button
          onClick={suggestReply}
          disabled={aiSuggest.isPending || sending}
          title="Have the AI draft a reply — it lands in the box for you to edit and send"
          data-testid="composer-ai-suggest"
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-black/60 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white/60 dark:hover:bg-white/5"
        >
          {aiSuggest.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} AI reply
        </button>
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

      {/* Staged files: uploaded on pick, so by send time these are just ids. */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2" data-testid="composer-attachments">
          {attachments.map((a) => (
            <span
              key={a.key}
              className={cn(
                "flex max-w-[220px] items-center gap-1.5 rounded-xl border px-2 py-1 text-xs",
                a.status === "error"
                  ? "border-red-400/40 bg-red-500/5 text-red-600 dark:text-red-400"
                  : "border-black/10 bg-black/[0.03] text-black/70 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/70",
              )}
              title={a.status === "error" ? a.error : `${a.file.name} (${formatBytes(a.file.size)})`}
              data-testid={`composer-attachment-${a.key}`}
            >
              {a.status === "uploading" ? (
                <Loader2 className="h-3 w-3 flex-none animate-spin" />
              ) : a.status === "error" ? (
                <AlertCircle className="h-3 w-3 flex-none" />
              ) : (
                <Paperclip className="h-3 w-3 flex-none" />
              )}
              <span className="truncate">{a.file.name}</span>
              <span className="flex-none opacity-50">{formatBytes(a.file.size)}</span>
              <button
                type="button"
                onClick={() => removeAttachment(a.key)}
                className="flex-none opacity-50 transition hover:opacity-100"
                aria-label={`Remove ${a.file.name}`}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div
        className={cn(
          "flex items-end gap-2 rounded-2xl border px-3 py-2",
          mode === "note"
            ? "border-amber-400/40 bg-amber-400/5"
            : "border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03]",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            pickFiles(e.target.files);
            // Reset so picking the same file twice in a row still fires onChange.
            e.target.value = "";
          }}
          data-testid="conversation-composer-file-input"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!canAttach}
          title={canAttach ? "Attach a file" : "Attachments aren't supported on internal notes"}
          className="mb-1 text-black/40 hover:text-black disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-black/40 dark:text-white/40 dark:hover:text-white"
          data-testid="conversation-composer-attach"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <button className="mb-1 text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white">
          <Pen className="h-4 w-4" />
        </button>
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="mb-1 text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white"
              title="Insert emoji"
              data-testid="conversation-composer-emoji"
            >
              <Smile className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" side="top" className="w-72 p-2">
            <div className="max-h-[240px] space-y-2 overflow-y-auto" data-testid="conversation-emoji-picker">
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
          // Native browser spellcheck, stated explicitly so it can't be lost, with
          // the dictionary pinned to en-GB — on a US-locale machine the browser
          // otherwise flags "organise"/"colour" in every outbound message.
          spellCheck
          lang="en-GB"
          className="min-h-0 flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          data-testid="conversation-composer-input"
        />
        <Button
          onClick={submit}
          disabled={(!text.trim() && ready.length === 0) || uploading || sending}
          size="icon"
          title={uploading ? "Waiting for the upload to finish…" : undefined}
          className="mb-1 h-9 w-9 flex-shrink-0 rounded-xl bg-black text-white hover:bg-black/85 disabled:opacity-40 dark:bg-white dark:text-black"
          data-testid="conversation-send"
        >
          {sending || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
type Overlay = Record<string, { extraMessages: ConversationMessage[]; snoozed?: boolean }>;

export default function ConversationsInbox() {
  const [tab, setTab] = useState<InboxTab>("open");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>({});
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [testAiOpen, setTestAiOpen] = useState(false);
  const [inboxId, setInboxId] = useState<string | null>(null); // null = All Messages
  // Conversation id → ISO timestamp of when the user last opened it. Clears the
  // unread dot locally the instant a conversation is opened, without waiting on
  // (or depending on) SendSeven accepting the mark-read PATCH.
  const [seenAt, setSeenAt] = useState<Record<string, string>>({});
  // Conversation id → unsent composer content. A ref rather than state: it is
  // read only when the composer mounts, so recording every keystroke here must
  // not re-render the whole inbox. Session-scoped — drafts do not survive a
  // page reload.
  const draftsRef = useRef<Record<string, ComposerDraft>>({});
  // Conversation id → the draft text shown as a "Draft" tag in the list. This
  // is state (the list must re-render) but it only flips on two rare events, so
  // it never churns per keystroke: a tag appears when the user navigates away
  // from a thread with unsent text, and retires when they resume typing in it
  // or the draft empties out.
  const [draftTags, setDraftTags] = useState<Record<string, string>>({});

  const { orgRole } = useRole();
  const canManageChannels = orgRole === "org_admin" || orgRole === "branch_manager" || orgRole === "platform_admin";
  // Same roles as the AI test-flow gate (server-enforced too).
  const canTestAi = orgRole === "org_admin" || orgRole === "platform_admin";

  // The SSE connection is owned app-wide by ConversationsRealtimeProvider (it
  // also raises the new-message toast); read its state rather than opening a
  // second stream here.
  const { connected: realtimeConnected } = useConversationsRealtimeState();

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
  // Same rule as the sidebar nav badge — see unreadBadgeCount.
  const unreadCount = unreadBadgeCount(badges);
  const qc = useQueryClient();
  const snoozeMutation = useSnoozeConversation();
  const unsnoozeMutation = useUnsnoozeConversation();
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
            messages: [...c.messages, ...o.extraMessages],
            preview: o.extraMessages.length > 0 ? o.extraMessages[o.extraMessages.length - 1].body : c.preview,
            lastActivityAt: o.extraMessages.length > 0 ? o.extraMessages[o.extraMessages.length - 1].sentAt : c.lastActivityAt,
            unread: o.extraMessages.length > 0 ? false : c.unread,
            snoozed: o.snoozed ?? c.snoozed,
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
      // The server already filters by tab; this mirrors it so optimistic local
      // changes (close/snooze) move a row out of the list immediately.
      .filter((c) =>
        tab === "snoozed"
          ? c.snoozed
          : tab === "closed"
            ? c.status === "closed"
            : c.status === "open" && !c.snoozed,
      )
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

  // Tag the thread the user just left if they walked away mid-sentence. Done on
  // the way out rather than while typing so the open thread never labels itself.
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    const left = prevSelectedRef.current;
    prevSelectedRef.current = selectedId;
    if (!left || left === selectedId) return;
    const text = draftsRef.current[left]?.text;
    if (!text) return;
    setDraftTags((tags) => (tags[left] === text ? tags : { ...tags, [left]: text }));
  }, [selectedId]);

  // Record the draft and retire the tag once the user picks the thread back up.
  // Stable identity (empty deps) so the composer's reporting effect only fires
  // on real edits — see the `restored` guard there.
  const handleDraftChange = useCallback((conversationId: string, draft: ComposerDraft) => {
    if (draft.text) draftsRef.current[conversationId] = draft;
    else delete draftsRef.current[conversationId];

    setDraftTags((tags) => {
      if (!(conversationId in tags)) return tags;
      const next = { ...tags };
      delete next[conversationId];
      return next;
    });
  }, []);

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

  const handleSend = (body: string, mode: "reply" | "note", attachments?: ComposerAttachments) => {
    if (!selected) return;
    const convId = selected.id;
    const hasFiles = (attachments?.ids.length ?? 0) > 0;
    // Optimistic bubble for instant feedback… the attachments themselves only
    // appear once the refetch lands (we hold ids, not the rendered media), so
    // name them in the placeholder rather than showing an empty bubble.
    const optimisticMsg: ConversationMessage = {
      id: `opt-${convId}-${new Date().getTime()}`,
      direction: "outbound",
      body: body || (hasFiles ? attachments!.filenames.join(", ") : ""),
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
    else
      sendMessage.mutate(
        {
          conversation_id: convId,
          // SendSeven media sends must declare the media kind (image/video/
          // audio/document) as the message_type — "text" carries plain text
          // only. Derived from the first attachment: SendSeven delivers one
          // attachment per message downstream, so the first decides. `text`
          // still rides along as the caption.
          message_type: hasFiles ? messageTypeForContentType(attachments!.contentTypes[0] ?? "") : "text",
          text: body,
          ...(hasFiles
            ? { attachments: attachments!.ids, attachment_filenames: attachments!.filenames }
            : {}),
        },
        opts,
      );
  };

  // Snooze presets. `reopen_on_message: true` so a customer reply pulls the
  // thread straight back into Open — the provider clears the snooze on the first
  // genuine inbound message when this flag is set.
  const SNOOZE_PRESETS: Array<{ label: string; hours: number }> = [
    { label: "1 hour", hours: 1 },
    { label: "3 hours", hours: 3 },
    { label: "Tomorrow", hours: 24 },
    { label: "Next week", hours: 24 * 7 },
  ];

  // Drop the optimistic snoozed override so server data rules again. Leaving it
  // in place would keep overriding every future refetch — e.g. hiding from Open
  // a conversation the provider already reopened because the client replied
  // (reopen_on_message), until a full page reload wiped the state.
  const clearSnoozeOverride = (convId: string) =>
    setOverlay((prev) => {
      const cur = prev[convId];
      if (!cur || cur.snoozed === undefined) return prev;
      return { ...prev, [convId]: { extraMessages: cur.extraMessages } };
    });

  // Await the refetch before clearing so the row doesn't flash back into the
  // old tab in the gap between mutation success and fresh list data. On error,
  // clear immediately — that reverts the optimistic move.
  const settleSnoozeOverride = (convId: string) => ({
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: conversationsKeys.all });
      clearSnoozeOverride(convId);
    },
    onError: () => clearSnoozeOverride(convId),
  });

  const snoozeFor = (hours: number) => {
    if (!selected) return;
    const convId = selected.id;
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    // Optimistically mark it snoozed so it leaves the Open list immediately.
    setOverlay((prev) => {
      const cur = prev[convId] ?? { extraMessages: [] };
      return { ...prev, [convId]: { ...cur, snoozed: true } };
    });
    snoozeMutation.mutate(
      { id: convId, body: { snoozed_until: until, reopen_on_message: true } },
      settleSnoozeOverride(convId),
    );
  };

  const unsnooze = () => {
    if (!selected) return;
    const convId = selected.id;
    setOverlay((prev) => {
      const cur = prev[convId] ?? { extraMessages: [] };
      return { ...prev, [convId]: { ...cur, snoozed: false } };
    });
    unsnoozeMutation.mutate(convId, settleSnoozeOverride(convId));
  };

  // "Close conversation" — SendSeven's close endpoint isn't in our list scope,
  // so closing is modelled as a year-long snooze (the API caps snoozed_until
  // only to "must be in the future", and reopen_on_message still pulls the
  // thread back to Open if the client ever writes again). An internal note
  // stamps when it was closed so the thread carries an audit trail.
  const closeConversation = () => {
    if (!selected) return;
    const closedAt = new Date().toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    // Note first, while the conversation is still the selection — snoozeFor
    // optimistically drops it out of the Open list, which moves the selection.
    handleSend(`Close conversation from: ${closedAt}`, "note");
    snoozeFor(24 * 365);
  };

  // Group the thread's messages by day for the date dividers.
  const grouped = useMemo(
    () => (selected ? groupMessagesByDay(threadMessages) : []),
    [selected, threadMessages],
  );

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
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-[#0b0b0f]">
                {unreadCount > 99 ? "99+" : unreadCount}
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
          {(["open", "snoozed", "closed"] as const).map((t) => (
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
              <ConversationRow
                key={c.id}
                conversation={c}
                active={c.id === selectedId}
                onClick={() => setSelectedId(c.id)}
                draftPreview={draftTags[c.id]}
              />
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
                {canTestAi && <HeaderAction icon={FlaskConical} label="Test AI" onClick={() => setTestAiOpen(true)} />}
                {selected.snoozed ? (
                  <HeaderAction icon={AlarmClockOff} label="Unsnooze" onClick={unsnooze} />
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex items-center gap-1.5 rounded-xl border border-black/8 px-3 py-1.5 text-xs font-medium text-black/70 transition hover:bg-black/[0.03] dark:border-white/8 dark:text-white/70 dark:hover:bg-white/[0.04]"
                        data-testid="conversation-snooze"
                      >
                        <AlarmClock className="h-3.5 w-3.5" />
                        Snooze
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {SNOOZE_PRESETS.map((preset) => (
                        <DropdownMenuItem
                          key={preset.label}
                          onClick={() => snoozeFor(preset.hours)}
                          data-testid={`conversation-snooze-${preset.hours}h`}
                        >
                          {preset.label}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={closeConversation}
                        data-testid="conversation-snooze-close"
                      >
                        <XIcon className="mr-1.5 h-3.5 w-3.5" />
                        Close conversation
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
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
                      <DayDivider label={group.day} />
                      {group.messages.map((m) => (
                        <MessageBubble key={m.id} message={m} conversation={selected} />
                      ))}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Keyed by conversation: switching threads unmounts the composer, so
                no typed text, staged attachment, or reply/note mode can ever leak
                into a message addressed to a different contact. The draft map
                below is what carries the text back when you return. */}
            <Composer
              key={selected.id}
              onSend={handleSend}
              sending={sendMessage.isPending || createNote.isPending}
              conversation={selected}
              draft={draftsRef.current[selected.id]}
              onDraftChange={handleDraftChange}
            />
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
      {canTestAi && selected && (
        <TestAiModal conversationId={selected.id} open={testAiOpen} onOpenChange={setTestAiOpen} />
      )}
    </section>
  );
}

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
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
  SquarePen,
  Filter,
  Ellipsis,
  BadgePoundSterling,
  ShieldCheck,
  StickyNote,
  ArrowLeftRight,
  Unlink,
  Unplug,
  Pin,
  Link,
  Share2,
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
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, clientDisplayName } from "@/lib/utils";
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
import { useContactLink, useUnlinkContact } from "../api/use-contact-link";
import { CHANNELS } from "../channels";
import { toUiConversation, toUiMessage } from "../map";
import { conversationsApi } from "../api/conversations.api";
import { conversationsKeys, useConversations, useConversationBadgeCounts, unreadBadgeCount } from "../api/use-conversations-queries";
import {
  useAiSuggestReply,
  useAssignConversation,
  useMarkConversationRead,
  useSnoozeConversation,
  useUnsnoozeConversation,
  useUpdateConversation,
} from "../api/use-conversations-mutations";
import { useCurrentUser, useUsers, useClientNotes, useTransactions } from "@/hooks/queries";
import type { Quote, Transaction } from "@/features/quote/types";
import { useMessages, useSendMessage, useCreateInternalNote, useUploadAttachment } from "../api/use-messages";
import { MAX_ATTACHMENT_BYTES, messageTypeForContentType } from "../api/messages.api";
import { useConversationsRealtimeState } from "./conversations-realtime-provider";
import { useInboxes } from "../api/use-inboxes";
import type { SsInbox } from "../api/inboxes.api";
import type { Conversation, ConversationMessage, ConversationTag, InboxTab } from "../types";

// How often the composer re-announces that this agent is still typing. The
// server's indicator outlives one ping, so this is about keeping it alive, not
// tracking keystrokes.
const TYPING_PING_MS = 3_000;
// How long a pause counts as "stopped typing". Short enough that the indicator
// disappears about when the agent actually stops, long enough to survive
// thinking mid-sentence.
const TYPING_IDLE_MS = 1_500;

// Three bouncing dots — the same visual language as the AI chat widget, so
// "someone is composing" reads the same wherever it appears.
function TypingDots() {
  return (
    <span className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-black/35 dark:bg-white/35"
          animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

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

// Brand-style channel logo for the list row (design: big coloured circle with
// the channel's mark rather than contact initials).
function ChannelLogo({ channel }: { channel: Conversation["channel"] }) {
  // Same artwork as the Agent Dashboard's Latest Inbox (conversations-tab.tsx).
  if (channel === "messenger") {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0 xl:h-8 xl:w-8" aria-label="Messenger" role="img">
        <defs>
          <linearGradient id="inbox-msgr-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00B2FF" />
            <stop offset="100%" stopColor="#006AFF" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="11" fill="url(#inbox-msgr-grad)" />
        <path
          fill="#fff"
          d="M12 4.9c-4.06 0-7.2 2.97-7.2 6.67 0 2.09.99 3.94 2.6 5.17v2.36l2.4-1.32c.7.19 1.44.3 2.2.3 4.06 0 7.2-2.97 7.2-6.67S16.06 4.9 12 4.9zm.76 8.98-1.87-2-3.64 2 4-4.25 1.92 2 3.59-2-4 4.25z"
        />
      </svg>
    );
  }
  if (channel === "instagram") {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0 xl:h-8 xl:w-8" aria-label="Instagram" role="img">
        <defs>
          <radialGradient id="inbox-ig-grad" cx="0.3" cy="1.1" r="1.3">
            <stop offset="0%" stopColor="#FFDD55" />
            <stop offset="30%" stopColor="#FF543E" />
            <stop offset="60%" stopColor="#C837AB" />
            <stop offset="100%" stopColor="#3771C8" />
          </radialGradient>
        </defs>
        <circle cx="12" cy="12" r="11" fill="url(#inbox-ig-grad)" />
        <rect x="6.8" y="6.8" width="10.4" height="10.4" rx="3.2" fill="none" stroke="#fff" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="2.5" fill="none" stroke="#fff" strokeWidth="1.5" />
        <circle cx="15.35" cy="8.65" r="0.85" fill="#fff" />
      </svg>
    );
  }
  const meta = CHANNELS[channel];
  const Icon = meta.icon;
  return (
    <span className={cn("grid h-7 w-7 shrink-0 xl:h-8 xl:w-8 place-items-center rounded-full", meta.badge)} title={meta.label}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

// "16:33" for today, otherwise the usual day label.
function rowTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (!isNaN(d.getTime()) && d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  return dayLabel(iso);
}

// Category icon + colour for the inbox line (Fonts and Icons.txt, Messages):
// Sales → £ badge #b3b3b3, Admin → shield #808080.
function inboxIconFor(name: string): { Icon: typeof Mailbox; className: string } {
  const n = name.toLowerCase();
  if (n.includes("sales")) return { Icon: BadgePoundSterling, className: "text-[#b3b3b3]" };
  if (n.includes("admin")) return { Icon: ShieldCheck, className: "text-[#808080]" };
  return { Icon: Mailbox, className: "text-black/45 dark:text-white/45" };
}

function ConversationRow({
  conversation,
  active,
  onClick,
  draftPreview,
  inboxName,
}: {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
  // Unsent text left behind in this thread's composer. Takes over the preview
  // slot so the agent can see at a glance where they have a draft waiting.
  draftPreview?: string;
  inboxName?: string;
}) {
  // The category line: the agent-chosen type (Sales / Admin) wins; an inbox
  // name is the fallback for conversations that haven't been classified yet.
  const categoryLabel = conversation.conversationType
    ? CONVERSATION_TYPE_LABELS[conversation.conversationType]
    : inboxName;
  const category = categoryLabel ? inboxIconFor(categoryLabel) : null;
  return (
    <button
      onClick={onClick}
      data-testid={`conversation-row-${conversation.id}`}
      className={cn(
        "relative w-full px-3 py-3 text-left transition",
        active
          ? "rounded-2xl border border-sky-100 bg-sky-50 dark:border-sky-500/20 dark:bg-sky-500/10"
          : "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
      )}
    >
      <div className="flex items-start gap-3">
        <ChannelLogo channel={conversation.channel} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[15px] font-medium text-black/85 xl:text-[17px] dark:text-white/85">
              {conversation.contact.displayName}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {conversation.unread && <span className="h-2 w-2 rounded-full bg-sky-500" />}
              <span className="whitespace-nowrap text-xs text-black/45 dark:text-white/45">
                {rowTime(conversation.lastActivityAt)}
              </span>
            </span>
          </div>
          {categoryLabel && category && (
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#a195a5] xl:text-[13px] dark:text-white/50" data-testid={`conversation-type-${conversation.id}`}>
              <category.Icon className={cn("h-4 w-4 shrink-0", category.className)} />
              <span className="truncate">{categoryLabel}</span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-3">
        <span className="w-9 shrink-0 text-center text-[10px] tracking-[0.2em] text-[#a195a5]/70 dark:text-white/30" aria-hidden>
          ···
        </span>
        {draftPreview ? (
          <span className="flex min-w-0 items-center gap-1.5 text-xs" data-testid={`conversation-draft-${conversation.id}`}>
            <span className="shrink-0 rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Draft
            </span>
            <span className="truncate text-xs text-[#a195a5] xl:text-[13px] dark:text-white/50">{draftPreview}</span>
          </span>
        ) : (
          <span className="truncate text-xs text-[#a195a5] xl:text-[13px] dark:text-white/50">{conversation.preview}</span>
        )}
      </div>
      {!active && (
        <span className="pointer-events-none absolute bottom-0 left-3 right-3 h-px bg-black/[0.06] dark:bg-white/[0.06]" aria-hidden />
      )}
    </button>
  );
}

// ─── Conversation type ────────────────────────────────────────────────────────
const CONVERSATION_TYPE_LABELS: Record<"sales" | "admin", string> = { sales: "Sales", admin: "Admin" };

// Small chip in the thread header for classifying the conversation. Persisted
// on our side (sendseven_conversation_state.conversation_type) via the same
// PATCH the other local fields use; the list row reads it back.
function ConversationTypeControl({ conversation }: { conversation: Conversation }) {
  const { toast } = useToast();
  const update = useUpdateConversation();
  const current = conversation.conversationType ?? null;
  const Icon = current ? inboxIconFor(CONVERSATION_TYPE_LABELS[current]).Icon : Tag;

  const setType = (type: "sales" | "admin" | null) =>
    update.mutate(
      { id: conversation.id, body: { conversation_type: type } },
      {
        onSuccess: () =>
          toast({
            title: type ? `Marked as ${CONVERSATION_TYPE_LABELS[type]}` : "Type cleared",
            description: type ? "Shown under the contact's name in the inbox list." : undefined,
          }),
        onError: (err) => {
          const e = err as { response?: { data?: { message?: string } }; message?: string };
          toast({ title: "Could not update type", description: e?.response?.data?.message ?? e?.message, variant: "destructive" });
        },
      },
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold transition",
            current
              ? "bg-black/[0.05] text-black/70 hover:bg-black/10 dark:bg-white/10 dark:text-white/80"
              : "border border-dashed border-black/20 text-black/45 hover:text-black dark:border-white/20 dark:text-white/45",
          )}
          title="Conversation type"
          data-testid="conversation-type"
        >
          <Icon className="h-3 w-3" />
          {current ? CONVERSATION_TYPE_LABELS[current] : "Set type"}
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="rounded-xl">
        <DropdownMenuItem onClick={() => setType("sales")} className="gap-2 rounded-lg text-sm" data-testid="conversation-type-sales">
          <BadgePoundSterling className="h-4 w-4" /> Sales {current === "sales" && <Check className="ml-auto h-3.5 w-3.5" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setType("admin")} className="gap-2 rounded-lg text-sm" data-testid="conversation-type-admin">
          <ShieldCheck className="h-4 w-4" /> Admin {current === "admin" && <Check className="ml-auto h-3.5 w-3.5" />}
        </DropdownMenuItem>
        {current && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setType(null)} className="gap-2 rounded-lg text-sm" data-testid="conversation-type-clear">
              <XIcon className="h-4 w-4" /> Clear
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Linked client phone ──────────────────────────────────────────────────────
// The pill beside the contact's name shows the CRM client's phone number —
// only when the conversation is linked to a client. Unlinked conversations
// show nothing (the SendSeven contact id is an opaque UUID, never useful here).
// Shares the contact-link query (and its cache) with the ContactPanel.
function LinkedClientPhonePill({ conversation }: { conversation: Conversation }) {
  const { data: link } = useContactLink(conversation.contact.id, contactLinkMatch(conversation));
  const phone = link?.linkedClient?.phoneNumber?.trim();
  if (!phone) return null;
  return (
    <span
      className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-3 py-0.5 text-xs font-semibold text-violet-600 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300"
      data-testid="conversation-client-phone"
    >
      {phone}
    </span>
  );
}

// ─── Assign control ───────────────────────────────────────────────────────────
// Thread-header dropdown for assigning the conversation to a Travana staff
// member. Assignment is PLATFORM data (stored in our DB and overlaid onto the
// proxied conversation payload server-side) — SendSeven is not involved, so no
// per-agent SendSeven account is needed.
function AssignControl({ conversation }: { conversation: Conversation }) {
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const { data: staff = [], isLoading } = useUsers();
  const assignMutation = useAssignConversation();
  const updateMutation = useUpdateConversation();

  const me = currentUser?.id ? staff.find((m) => m.id === currentUser.id) ?? { id: currentUser.id, name: "" } : undefined;

  const onError = (err: unknown) => {
    const e = err as { response?: { data?: { message?: string } }; message?: string };
    toast({
      title: "Could not update assignment",
      description: e?.response?.data?.message ?? e?.message ?? "Unknown error",
      variant: "destructive",
    });
  };

  const doAssign = (userId: string) =>
    assignMutation.mutate(
      { id: conversation.id, userId },
      { onError, onSuccess: (conv) => toast({ title: "Conversation assigned", description: (conv.assigned_user as { name?: string } | null)?.name ?? undefined }) },
    );
  const doUnassign = () =>
    updateMutation.mutate(
      { id: conversation.id, body: { assigned_user_id: null } },
      { onError, onSuccess: () => toast({ title: "Conversation unassigned" }) },
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-10 items-center gap-1.5 rounded-md px-1.5 text-sm text-black/60 transition hover:bg-black/[0.03] dark:text-white/60 dark:hover:bg-white/[0.04]"
          title={conversation.assignee ? `Assigned to ${conversation.assignee}` : "Assign"}
          data-testid="conversation-assign"
        >
          {conversation.assignee ? (
            <span className="relative grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[11px] font-bold text-white">
              {initials(conversation.assignee)}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0b0b0f]" />
            </span>
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-full border border-dashed border-black/25 text-black/45 dark:border-white/25 dark:text-white/45">
              <UserPlus className="h-4 w-4" />
            </span>
          )}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {me && (
          <>
            <DropdownMenuItem onClick={() => doAssign(me.id)} data-testid="conversation-assign-me">
              <User className="mr-1.5 h-3.5 w-3.5" />
              Assign to me
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {isLoading ? (
          <DropdownMenuItem disabled>Loading team…</DropdownMenuItem>
        ) : staff.length === 0 ? (
          <DropdownMenuItem disabled>No team members found</DropdownMenuItem>
        ) : (
          staff.map((m) => (
            <DropdownMenuItem
              key={m.id}
              onClick={() => doAssign(m.id)}
              data-testid={`conversation-assign-${m.id}`}
            >
              <User className="mr-1.5 h-3.5 w-3.5 shrink-0 text-black/40 dark:text-white/40" />
              <span className="truncate">{m.name || m.email}</span>
            </DropdownMenuItem>
          ))
        )}
        {conversation.assignee && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={doUnassign} data-testid="conversation-unassign">
              <XIcon className="mr-1.5 h-3.5 w-3.5" />
              Unassign
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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

// One labelled value in the Client Details panel: grey label, red icon, bold value.
function ClientField({ label, icon: Icon, value }: { label: string; icon: typeof User; value: string }) {
  return (
    <div>
      <div className="text-xs text-black/45 dark:text-white/45">{label}</div>
      <div className="mt-1 flex items-center gap-2.5">
        <Icon className="h-4 w-4 shrink-0 text-[#ff0000]" strokeWidth={1.25} />
        <span className="truncate text-sm font-bold xl:text-base">{value}</span>
      </div>
    </div>
  );
}

function memberSince(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// ─── Live Quotes ──────────────────────────────────────────────────────────────

// Quote joins (destination, departing airport, operator name) aren't declared on
// the base `Quote` type, but the transactions API returns them alongside it —
// same shape pipeline-live-panel casts around.
type LiveQuoteRecord = Quote & {
  destination_name?: string | null;
  departing_airport_name?: string | null;
  departing_airport_code?: string | null;
  main_tour_operator_name?: string | null;
};

const liveQuoteCurrency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const LIVE_QUOTE_CHIP_PALETTE = ["bg-red-500", "bg-sky-500", "bg-orange-500", "bg-emerald-600", "bg-indigo-500"];

// Colored initial chip for the quote's tour operator — same pattern as
// PipelineLivePanel's OperatorChip, replicated locally since cross-feature
// imports between agent-overview and conversations aren't allowed.
function LiveQuoteOperatorChip({ name }: { name: string | null }) {
  const label = (name || "•")[0]?.toUpperCase() || "•";
  const hash = [...(name || "x")].reduce((s, c) => s + c.charCodeAt(0), 0);
  return (
    <span
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-md text-sm font-bold text-white",
        LIVE_QUOTE_CHIP_PALETTE[hash % LIVE_QUOTE_CHIP_PALETTE.length],
      )}
      title={name || undefined}
      aria-hidden
    >
      {label}
    </span>
  );
}

const LIVE_QUOTE_EXCLUDED_STATUSES = new Set(["lost", "archived", "won"]);

function isLiveQuoteStatus(status: string | null | undefined): boolean {
  return !!status && !LIVE_QUOTE_EXCLUDED_STATUSES.has(status.toLowerCase());
}

function liveQuoteFormatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Quotes don't carry a return date — derive it from travel_date + num_of_nights.
function liveQuoteReturnDate(travelDate: string | null | undefined, nights: number | null | undefined): string | null {
  if (!travelDate || !nights) return null;
  const d = new Date(travelDate);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + nights);
  return liveQuoteFormatDate(d.toISOString());
}

// Picks each transaction's primary quote (the non-copy one, falling back to the
// first) and keeps only those still "live" (not lost/archived/won), newest first.
function selectLiveQuotes(transactions: Transaction[] | undefined): LiveQuoteRecord[] {
  const primaries = (transactions ?? [])
    .map((t) => (t.quotes?.find((q) => !q.isQuoteCopy) || t.quotes?.[0]) as LiveQuoteRecord | undefined)
    .filter((q): q is LiveQuoteRecord => !!q && isLiveQuoteStatus(q.quote_status));
  return [...primaries]
    .sort((a, b) => new Date(b.date_created || 0).getTime() - new Date(a.date_created || 0).getTime())
    .slice(0, 5);
}

function ContactPanel({ conversation }: { conversation: Conversation }) {
  const { contact } = conversation;
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [notesOpen, setNotesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [liveQuotesOpen, setLiveQuotesOpen] = useState(true);

  // Shares the cached contact-link query with ClientLinkSection (keyed by
  // contact id). When linked, the panel shows the CRM client's record.
  const { data: link } = useContactLink(conversation.contact.id, contactLinkMatch(conversation));
  const client = link?.linkedClient ?? null;
  const unlinkContact = useUnlinkContact(conversation.contact.id);
  const { data: notes = [] } = useClientNotes(client?.id ?? "");
  const { data: transactions, isLoading: isLoadingLiveQuotes } = useTransactions(
    { clientId: client?.id ?? "" },
    { enabled: !!client?.id },
  );
  const liveQuotes = useMemo(() => (client ? selectLiveQuotes(transactions) : []), [client, transactions]);
  // Lifetime counts for the History tiles — same shapes the client profile page
  // derives from this endpoint (enquiries/quotes/bookings across transactions).
  const historyCounts = useMemo(() => {
    const txns = transactions ?? [];
    return {
      enquiries: txns.filter((t) => t.enquiry).length,
      quotes: txns.flatMap((t) => t.quotes || []).length,
      bookings: txns.filter((t) => t.booking).length,
    };
  }, [transactions]);

  const unlink = async () => {
    try {
      await unlinkContact.mutateAsync();
      toast({ title: "Unlinked", description: "This contact is no longer linked to a client." });
    } catch (err) {
      toast({ title: "Couldn't unlink", description: (err as Error).message, variant: "destructive" });
    }
  };

  const since = client ? memberSince(client.createdAt) : null;

  return (
    <Card className="flex flex-col overflow-hidden rounded-none border-0 border-l border-black/10 bg-white p-0 shadow-none dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex h-[76px] shrink-0 items-center border-b border-black/10 px-4 xl:px-6 dark:border-white/10">
        <h2 className="text-[15px] font-semibold xl:text-[17px]">Client Details</h2>
      </div>

      <div className="scrollbar-none flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="space-y-5 border-b border-black/10 px-4 py-5 xl:px-6 dark:border-white/10">
          {client ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <ClientField label="Name" icon={User} value={clientDisplayName(client)} />
                <div className="flex shrink-0 items-center gap-2 pt-0.5">
                  <span className="rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white" data-testid="client-linked-badge">
                    Linked
                  </span>
                  <button
                    type="button"
                    onClick={unlink}
                    disabled={unlinkContact.isPending}
                    title="Unlink this client"
                    className="text-[#ff0000] transition hover:text-red-600 disabled:opacity-50"
                    data-testid="client-unlink"
                  >
                    {unlinkContact.isPending ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Unplug className="h-4.5 w-4.5" strokeWidth={1.25} />}
                  </button>
                </div>
              </div>
              {client.phoneNumber && <ClientField label="Contact" icon={Phone} value={client.phoneNumber} />}
              {!client.phoneNumber && client.email && <ClientField label="Contact" icon={Mail} value={client.email} />}
              {since && <ClientField label="Member Since" icon={CalendarDays} value={since} />}
            </>
          ) : (
            <>
              <ClientField label="Name" icon={User} value={contact.displayName} />
              {/* Not linked yet: suggestions + link / create-client actions. */}
              <ClientLinkSection conversation={conversation} />
            </>
          )}
        </div>

        {client && (
          <div className="border-t border-black/10 dark:border-white/10" data-testid="client-history">
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-5 text-left xl:px-6"
              data-testid="client-history-toggle"
            >
              <span className="text-sm font-bold">History</span>
              <ChevronRight className={cn("h-4 w-4 text-black/50 transition dark:text-white/50", historyOpen && "rotate-90")} />
            </button>
            {historyOpen && (
              <div className="grid grid-cols-3 gap-3 px-4 pb-5 xl:px-6">
                {[
                  { label: "Enquiries", count: historyCounts.enquiries, className: "text-emerald-500" },
                  { label: "Quotes", count: historyCounts.quotes, className: "text-sky-500" },
                  { label: "Bookings", count: historyCounts.bookings, className: "text-amber-500" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-black/10 px-2 py-3 text-center dark:border-white/10"
                    data-testid={`client-history-${stat.label.toLowerCase()}`}
                  >
                    <div className="text-2xl font-semibold">{isLoadingLiveQuotes ? "–" : stat.count}</div>
                    <div className={cn("mt-0.5 text-[13px]", stat.className)}>{stat.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {client && (
          <div className="border-t border-black/10 dark:border-white/10" data-testid="client-live-quotes">
            <button
              type="button"
              onClick={() => setLiveQuotesOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-5 text-left xl:px-6"
              data-testid="client-live-quotes-toggle"
            >
              <span className="text-sm font-bold">Live Quotes</span>
              <ChevronRight className={cn("h-4 w-4 text-black/50 transition dark:text-white/50", liveQuotesOpen && "rotate-90")} />
            </button>
            {liveQuotesOpen && (
              <div className="space-y-1 px-4 pb-5 xl:px-6">
                {isLoadingLiveQuotes ? (
                  <p className="text-center text-xs text-black/45 dark:text-white/45">Loading…</p>
                ) : liveQuotes.length === 0 ? (
                  <p className="text-center text-xs text-black/45 dark:text-white/45">No live quotes</p>
                ) : (
                  liveQuotes.map((q) => {
                    const price = parseFloat(q.sales_price || "0") || 0;
                    const departureDate = liveQuoteFormatDate(q.travel_date);
                    const returnDate = liveQuoteReturnDate(q.travel_date, q.num_of_nights);
                    const dateRange = [departureDate, returnDate].filter(Boolean).join(" → ");
                    const departureLine = [q.departing_airport_code || q.departing_airport_name || null, dateRange || null].filter(Boolean).join(" - ");
                    return (
                      <div
                        key={q.id}
                        role="link"
                        tabIndex={0}
                        onClick={() => navigate(`/clients/${client.id}/quotes/${q.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/clients/${client.id}/quotes/${q.id}`);
                          }
                        }}
                        className="cursor-pointer rounded-lg p-3 transition hover:bg-[#e9f8ff] dark:hover:bg-white/[0.05]"
                        data-testid={`client-live-quote-${q.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <LiveQuoteOperatorChip name={q.main_tour_operator_name ?? null} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-sm font-semibold">{q.title || "Untitled quote"}</span>
                              {price > 0 && (
                                <span className="shrink-0 text-sm font-semibold text-black/60 dark:text-white/60">
                                  {liveQuoteCurrency.format(price)}
                                </span>
                              )}
                            </div>
                            {q.destination_name && (
                              <div className="mt-0.5 truncate text-[13px] text-[#a195a5] dark:text-white/50">
                                {q.destination_name}
                              </div>
                            )}
                            {departureLine && (
                              <div className="mt-0.5 truncate text-xs text-[#a195a5] dark:text-white/50">
                                {departureLine}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex-1" />

        <div className="border-t border-b border-black/10 dark:border-white/10">
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-5 text-left xl:px-6"
            data-testid="client-notes-toggle"
          >
            <span className="text-sm font-bold">Notes</span>
            <ChevronRight className={cn("h-4 w-4 text-black/50 transition dark:text-white/50", notesOpen && "rotate-90")} />
          </button>
          {notesOpen && (
            <div className="space-y-3 px-4 pb-5 xl:px-6" data-testid="client-notes">
              {!client ? (
                <p className="text-xs text-black/45 dark:text-white/45">Link this conversation to a client to see their notes.</p>
              ) : notes.length === 0 ? (
                <p className="text-xs text-black/45 dark:text-white/45">No notes on this client yet.</p>
              ) : (
                notes.map((n) => (
                  <div key={n.id} className="rounded-lg border border-black/10 p-3 dark:border-white/10">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-black/45 dark:text-white/45">
                      <span className="truncate font-semibold">{n.author_name || "Note"}</span>
                      <span className="shrink-0">{formatClientDate(n.createdAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-black/80 dark:text-white/80">
                      {stripHtml(n.content || n.description || "")}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
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
  // Presence ping. Throttled to one call per TYPING_PING_MS while the agent is
  // actively typing — the indicator outlives a single ping, so this keeps it
  // alive rather than tracking keystrokes.
  const lastTypingPing = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendTypingStop = useCallback(() => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
    // Only if we actually announced typing — otherwise this is a pointless
    // request on every thread switch.
    if (!lastTypingPing.current) return;
    lastTypingPing.current = 0;
    void conversationsApi.typing(conversation.id, true).catch(() => undefined);
  }, [conversation.id]);

  const pingTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingPing.current >= TYPING_PING_MS) {
      lastTypingPing.current = now;
      // Cosmetic: never surface a failure to the agent mid-sentence.
      void conversationsApi.typing(conversation.id, false).catch(() => undefined);
    }
    // Pausing is the common way people stop — waiting for the indicator to time
    // out leaves it hanging for seconds after they've clearly finished, so an
    // explicit stop is sent once they go quiet.
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(sendTypingStop, TYPING_IDLE_MS);
  }, [conversation.id, sendTypingStop]);

  // Clear the indicator for colleagues when this thread is left mid-draft.
  useEffect(() => sendTypingStop, [sendTypingStop]);
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
    <div className="px-4 pb-4 pt-2">
      <div
        className={cn(
          "rounded-xl border px-4 pt-3 pb-2.5",
          mode === "note"
            ? "border-amber-400/40 bg-amber-400/5"
            : "border-black/10 bg-white dark:border-white/10 dark:bg-white/[0.03]",
        )}
      >
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
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            // Clearing the box is as much a "stopped" as pausing is.
            if (e.target.value.trim()) pingTyping();
            else sendTypingStop();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendTypingStop();
              submit();
            }
          }}
          placeholder={mode === "note" ? "Add an internal note…" : "Type a message…"}
          rows={2}
          // Native browser spellcheck, stated explicitly so it can't be lost, with
          // the dictionary pinned to en-GB — on a US-locale machine the browser
          // otherwise flags "organise"/"colour" in every outbound message.
          spellCheck
          lang="en-GB"
          className="min-h-[56px] w-full resize-none border-0 bg-transparent px-0 py-1 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          data-testid="conversation-composer-input"
        />

        {/* Toolbar: note toggle · emoji · attach · enquiry · AI — and Send. */}
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1 text-black/45 dark:text-white/45">
            <button
              type="button"
              onClick={() => setMode(mode === "note" ? "reply" : "note")}
              className={cn(
                "flex items-center gap-1.5 rounded-sm px-1.5 py-1 text-sm transition hover:bg-black/5 dark:hover:bg-white/10",
                mode === "note" ? "font-semibold text-amber-600 dark:text-amber-300" : "hover:text-black dark:hover:text-white",
              )}
              title={mode === "note" ? "Switch back to reply" : "Write an internal note (not sent to the contact)"}
              data-testid="composer-mode-toggle"
            >
              <StickyNote className="h-4 w-4" />
              Note
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </button>
            <span className="mx-1 h-4 w-px bg-black/15 dark:bg-white/15" aria-hidden />
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-sm transition hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
                  title="Insert emoji"
                  data-testid="conversation-composer-emoji"
                >
                  <Smile className="h-4.5 w-4.5" />
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
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!canAttach}
              title={canAttach ? "Attach a file" : "Attachments aren't supported on internal notes"}
              className="grid h-8 w-8 place-items-center rounded-sm transition hover:bg-black/5 hover:text-black disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-white"
              data-testid="conversation-composer-attach"
            >
              <Paperclip className="h-4.5 w-4.5" />
            </button>
            <GenerateEnquiryButton conversation={conversation} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-sm transition hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
                  title="More"
                  data-testid="composer-more"
                >
                  <Ellipsis className="h-4.5 w-4.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="rounded-xl">
                <DropdownMenuItem disabled className="gap-2 rounded-lg text-sm">
                  <Bot className="h-4 w-4" /> Router-Bot
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="gap-2 rounded-lg text-sm">
                  <Languages className="h-4 w-4" /> Translate
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={suggestReply}
              disabled={aiSuggest.isPending || sending}
              title="Have the AI draft a reply — it lands in the box for you to edit and send"
              data-testid="composer-ai-suggest"
              className="ml-1 flex h-8 items-center gap-1 rounded-full bg-slate-500 px-3 text-xs font-semibold text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {aiSuggest.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              AI
            </button>
          </div>

          <Button
            onClick={submit}
            disabled={(!text.trim() && ready.length === 0) || uploading || sending}
            variant="outline"
            title={uploading ? "Waiting for the upload to finish…" : undefined}
            className="h-10 shrink-0 gap-2 rounded-md border-black/10 bg-black/[0.02] px-4 text-sm font-medium text-black/60 hover:bg-black/5 hover:text-black disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/70"
            data-testid="conversation-send"
          >
            {sending || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
            <span className="h-4 w-px bg-black/15 dark:bg-white/15" aria-hidden />
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Thread header action button ──────────────────────────────────────────────

function HeaderAction({ icon: Icon, label, onClick }: { icon: typeof User; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-md border border-black/10 text-black/55 transition hover:bg-black/[0.03] hover:text-black dark:border-white/10 dark:text-white/60 dark:hover:bg-white/[0.04] dark:hover:text-white"
    >
      <Icon className="h-4 w-4" />
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
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
  const { connected: realtimeConnected, typingByConversation } = useConversationsRealtimeState();

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
  const { toast } = useToast();
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
      .sort((a, b) => {
        const diff = new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
        return sortOrder === "newest" ? diff : -diff;
      });
  }, [conversations, tab, search, sortOrder]);

  const activeInbox = inboxId ? (inboxList.find((i) => i.id === inboxId) ?? null) : null;
  const inboxNameById = useMemo(() => new Map(inboxList.map((i) => [i.id, i.name])), [inboxList]);

  // Keep a valid selection: if the current pick fell out of the list, select the first.
  useEffect(() => {
    if (filtered.length === 0) {
      if (selectedId !== null) setSelectedId(null);
    } else if (!filtered.some((c) => c.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  // Presence for the OPEN thread only — the inbox list stays quiet.
  const typingHere = selectedId ? typingByConversation[selectedId] : undefined;

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
      className="-m-4 grid h-[calc(100vh-3.5rem)] grid-cols-[250px_1fr_240px] gap-0 overflow-hidden rounded-tl-lg md:-m-6 lg:grid-cols-[300px_1fr_300px] xl:grid-cols-[380px_1fr_380px]"
      data-testid="section-conversations"
    >
      {/* ── Conversation list ── */}
      <Card className="flex flex-col overflow-hidden rounded-none border-0 border-r border-black/10 bg-white p-0 shadow-none dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex h-[76px] shrink-0 items-center justify-between gap-2 border-b border-black/10 px-5 dark:border-white/10">
          <h2 className="text-[15px] font-semibold xl:text-[17px]">Inbox</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-md border transition",
                searchOpen
                  ? "border-black/20 bg-black/5 text-black dark:border-white/20 dark:bg-white/10 dark:text-white"
                  : "border-black/10 bg-white text-black/70 hover:bg-black/[0.03] dark:border-white/15 dark:bg-transparent dark:text-white/70",
              )}
              title="Search conversations"
              data-testid="conversation-search-toggle"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-md bg-sky-500 text-white transition hover:bg-sky-600"
              title="New message"
              data-testid="conversation-compose"
            >
              <SquarePen className="h-4 w-4" />
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/40 dark:text-white/40" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="h-8 rounded-xl border-black/10 bg-black/[0.03] pl-9 text-xs dark:border-white/10 dark:bg-white/[0.04]"
                data-testid="conversation-search"
              />
            </div>
          </div>
        )}

        <div className="px-4 pt-4">
          <div className="flex w-full items-center gap-1 rounded-sm border border-black/10 bg-black/[0.03] p-1 dark:border-white/10 dark:bg-white/[0.04]">
            {(["open", "snoozed", "closed"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 rounded-xs px-2 py-2 text-center text-sm font-semibold transition",
                  tab === t
                    ? "border border-black/10 bg-white text-black shadow-sm dark:border-white/15 dark:bg-white/15 dark:text-white"
                    : "text-[#7c98b0] hover:text-[#5f7d97] dark:text-white/45 dark:hover:text-white/70",
                )}
                data-testid={`inbox-tab-${t}`}
              >
                {t === "open" ? "Open" : t === "snoozed" ? "Snoozed" : "Done"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.06]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1 text-sm font-semibold text-[#7c98b0] hover:text-[#5f7d97] dark:text-white/60 dark:hover:text-white"
                data-testid="conversation-sort"
              >
                {sortOrder === "newest" ? "Newest" : "Oldest"}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="rounded-xl">
              <DropdownMenuItem onClick={() => setSortOrder("newest")} className="flex items-center justify-between gap-3 rounded-lg text-sm">
                Newest {sortOrder === "newest" && <Check className="h-3.5 w-3.5" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder("oldest")} className="flex items-center justify-between gap-3 rounded-lg text-sm">
                Oldest {sortOrder === "oldest" && <Check className="h-3.5 w-3.5" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-1">
            {/* Inbox filter: All Messages + custom inboxes from SendSeven */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-md transition hover:bg-black/5 dark:hover:bg-white/10",
                    inboxId ? "text-sky-600" : "text-[#7c98b0] dark:text-white/60",
                  )}
                  title={activeInbox?.name ?? "All Messages"}
                  data-testid="conversation-inbox-switcher"
                >
                  <Filter className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[60vh] w-56 overflow-y-auto rounded-xl">
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="grid h-7 w-7 place-items-center rounded-md text-[#7c98b0] transition hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
                  title="More"
                  data-testid="conversation-list-more"
                >
                  <Ellipsis className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem disabled className="gap-2 rounded-lg text-xs">
                  <span
                    className={cn("h-2 w-2 rounded-full", realtimeConnected ? "bg-emerald-500" : "bg-black/20 dark:bg-white/20")}
                    data-testid="conversation-realtime-indicator"
                  />
                  {realtimeConnected ? "Live updates on" : "Reconnecting…"}
                  {unreadCount > 0 && <span className="ml-auto font-semibold">{unreadCount} unread</span>}
                </DropdownMenuItem>
                {canManageChannels && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setChannelsOpen(true)} className="gap-2 rounded-lg text-sm" data-testid="conversation-channels-button">
                      <RadioTower className="h-4 w-4" /> Channels
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="scrollbar-none flex-1 overflow-y-auto px-2 pt-2">
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
                inboxName={c.inboxId ? inboxNameById.get(c.inboxId) : undefined}
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
      <Card className="flex flex-col overflow-hidden rounded-none border-0 bg-white p-0 shadow-none dark:bg-white/[0.04]">
        {selected ? (
          <>
            <div className="flex h-[76px] shrink-0 items-center justify-between gap-3 border-b border-black/10 px-6 dark:border-white/10">
              <div className="flex min-w-0 items-center gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="truncate text-[15px] font-semibold xl:text-[17px]">{selected.contact.displayName}</span>
                    <LinkedClientPhonePill conversation={selected} />
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold", CHANNELS[selected.channel].chip)}>
                      {CHANNELS[selected.channel].label}
                    </span>
                    <ConversationTypeControl conversation={selected} />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <AssignControl conversation={selected} />
                <HeaderAction icon={Pin} label="Pin conversation (coming soon)" />
                <HeaderAction
                  icon={Link}
                  label="Copy conversation link"
                  onClick={() => {
                    const url = `${window.location.origin}/conversations?conversation=${selected.id}`;
                    navigator.clipboard
                      .writeText(url)
                      .then(() => toast({ title: "Link copied", description: url }))
                      .catch(() => toast({ title: "Couldn't copy link", variant: "destructive" }));
                  }}
                />
                <HeaderAction icon={Share2} label="Share (coming soon)" />

                {/* Everything that used to sit in the header lives in this menu. */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="grid h-10 w-10 place-items-center rounded-md text-black/55 transition hover:bg-black/[0.03] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.04] dark:hover:text-white"
                      title="More actions"
                      data-testid="conversation-more"
                    >
                      <Ellipsis className="h-5 w-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60 rounded-xl">
                    <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/40">
                      AI
                    </DropdownMenuLabel>
                    <div className="px-2 pb-1.5" onClick={(e) => e.stopPropagation()}>
                      <AiStatusControl conversationId={selected.id} />
                    </div>
                    {canTestAi && (
                      <DropdownMenuItem onClick={() => setTestAiOpen(true)} className="gap-2 rounded-lg text-sm" data-testid="conversation-test-ai">
                        <FlaskConical className="h-4 w-4" /> Test AI
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {selected.snoozed ? (
                      <DropdownMenuItem onClick={unsnooze} className="gap-2 rounded-lg text-sm" data-testid="conversation-unsnooze">
                        <AlarmClockOff className="h-4 w-4" /> Unsnooze
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="gap-2 rounded-lg text-sm" data-testid="conversation-snooze">
                          <AlarmClock className="h-4 w-4" /> Snooze
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="rounded-xl">
                          {SNOOZE_PRESETS.map((preset) => (
                            <DropdownMenuItem
                              key={preset.label}
                              onClick={() => snoozeFor(preset.hours)}
                              className="rounded-lg text-sm"
                              data-testid={`conversation-snooze-${preset.hours}h`}
                            >
                              {preset.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={closeConversation}
                      className="gap-2 rounded-lg text-sm text-red-600 focus:text-red-600 dark:text-red-400"
                      data-testid="conversation-snooze-close"
                    >
                      <XIcon className="h-4 w-4" /> Close conversation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.06] px-6 py-2 dark:border-white/[0.06]">
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
              className="scrollbar-none flex-1 space-y-5 overflow-y-auto px-6 py-6"
            >
              <div className="flex justify-center">
                <ChannelLogo channel={selected.channel} />
              </div>
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

            {typingHere && (
              <div
                className="flex items-center gap-2 border-t border-black/5 px-5 py-2 text-xs text-black/55 dark:border-white/5 dark:text-white/55"
                data-testid="conversation-typing-indicator"
                aria-live="polite"
              >
                <TypingDots />
                <span>
                  {typingHere.actor === "ai" ? "AI" : typingHere.name?.trim() || "Someone"} is typing…
                </span>
              </div>
            )}

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
        <Card className="hidden rounded-none border-0 border-l border-black/10 bg-white shadow-none dark:border-white/10 dark:bg-white/[0.04] xl:block" />
      )}

      {canManageChannels && <ChannelsDialog open={channelsOpen} onOpenChange={setChannelsOpen} />}
      {canTestAi && selected && (
        <TestAiModal conversationId={selected.id} open={testAiOpen} onOpenChange={setTestAiOpen} />
      )}
    </section>
  );
}

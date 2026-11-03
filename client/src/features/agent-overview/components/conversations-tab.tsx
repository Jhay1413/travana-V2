import { useLocation } from "wouter";
import { Instagram, Mail, MessageCircle, Send, type LucideIcon } from "lucide-react";
// Deep imports on purpose — the conversations feature barrel pulls the whole
// inbox into the bundle (see app-sidenav.tsx for the same pattern).
import { useConversations } from "@/features/conversations/api/use-conversations-queries";
import type { SsConversation } from "@/features/conversations/api/conversations.api";
import { cn } from "@/lib/utils";
import { EmptyLine, HomeLink, PersonAvatar, RowButton } from "./home/home-ui";

const SHOWN = 5;

/** "25m" / "3h" / "2d" since the last message. */
export function waitLabel(date: string | null | undefined, now: number = Date.now()): string {
  if (!date) return "";
  const t = new Date(date).getTime();
  if (isNaN(t)) return "";
  const mins = Math.max(0, Math.floor((now - t) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function channelBadge(channelType?: string | null): { icon: LucideIcon; className: string; label: string } {
  const t = (channelType || "").toLowerCase();
  if (t.includes("messenger") || t.includes("facebook")) return { icon: Send, className: "bg-blue-500", label: "Messenger" };
  if (t.includes("instagram")) return { icon: Instagram, className: "bg-pink-500", label: "Instagram" };
  if (t.includes("email") || t.includes("mail")) return { icon: Mail, className: "bg-amber-500", label: "Email" };
  return { icon: MessageCircle, className: "bg-emerald-500", label: "Chat" };
}

function contactName(c: SsConversation): string {
  const contact = c.contact as Record<string, unknown> | null | undefined;
  const name = typeof contact?.name === "string" ? contact.name : "";
  const first = typeof contact?.first_name === "string" ? contact.first_name : "";
  const last = typeof contact?.last_name === "string" ? contact.last_name : "";
  return name || [first, last].filter(Boolean).join(" ") || c.subject || "Unknown contact";
}

// A snooze is only active while `snoozed_until` is in the future — same rule
// as the inbox's own map.ts (isSnoozeActive), duplicated here since that
// helper isn't exported and this widget works off the raw list item rather
// than the mapped UI Conversation.
function isSnoozed(c: SsConversation): boolean {
  const until = c.snoozed_until ? Date.parse(c.snoozed_until) : NaN;
  return !Number.isNaN(until) && until > Date.now();
}

function ChannelAvatar({ name, channelType }: { name: string; channelType?: string | null }) {
  const { icon: Icon, className, label } = channelBadge(channelType);
  return (
    <span className="relative h-[38px] w-[38px] shrink-0">
      <PersonAvatar name={name} size={38} />
      <span
        title={label}
        className={cn(
          "absolute -bottom-1 -right-1 grid h-[17px] w-[17px] place-items-center rounded-full border-2 border-card text-white",
          className,
        )}
      >
        <Icon className="h-[9px] w-[9px]" strokeWidth={2.4} />
      </span>
    </span>
  );
}

export function ConversationsTab() {
  const [, navigate] = useLocation();
  // "Latest Inbox" only makes sense for conversations still awaiting action —
  // closed and snoozed ones would otherwise clutter the widget. `status: "open"`
  // filters server-side, but the provider still reports snoozed conversations
  // under the "open" status (snoozing never changes `status`, only
  // `snoozed_until` — see conversations/types.ts), so a client-side check on
  // top is required to actually exclude them.
  const { data } = useConversations({ pageSize: 8, status: "open" });
  const conversations = (data?.items ?? []).filter((c) => !isSnoozed(c)).slice(0, SHOWN);

  return (
    <div className="flex flex-col" data-testid="panel-dashboard-conversations">
      {conversations.length === 0 ? (
        <EmptyLine testId="empty-dashboard-conversations">You are all caught up.</EmptyLine>
      ) : (
        conversations.map((c) => {
          const name = contactName(c);
          const preview = c.last_message?.text || c.subject || "";
          const wait = waitLabel(c.last_message_at || c.created_at);
          const href = `/conversations?conversation=${c.id}`;
          return (
            <RowButton
              key={c.id}
              onActivate={() => navigate(href)}
              className="flex items-center gap-3 rounded-none border-t border-social-border py-3 hover:bg-social-page xl:gap-3.5"
              testId={`row-dashboard-conversation-${c.id}`}
            >
              <ChannelAvatar name={name} channelType={c.channel_type} />
              <div className="min-w-0 flex-1">
                <div className={cn("truncate text-[13px] xl:text-[14px]", c.needs_reply ? "font-semibold" : "font-medium")}>
                  {name}
                </div>
                {preview && <div className="truncate text-[11px] text-social-muted xl:text-[12px]">{preview}</div>}
              </div>
              {c.needs_reply && (
                <span
                  className="whitespace-nowrap text-[11px] font-semibold text-amber-800 xl:text-[12px] dark:text-amber-400"
                  data-testid={`pill-dashboard-conversation-${c.id}`}
                >
                  Needs reply{wait ? ` · ${wait}` : ""}
                </span>
              )}
            </RowButton>
          );
        })
      )}

      <div className="mt-3.5">
        <HomeLink href="/conversations" testId="link-view-all-conversations">
          Open inbox
        </HomeLink>
      </div>
    </div>
  );
}

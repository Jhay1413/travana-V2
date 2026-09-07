import { Link, useLocation } from "wouter";
import { Ellipsis, Mail, MessageCircle } from "lucide-react";
// Deep import on purpose — the conversations feature barrel pulls the whole
// inbox into the bundle (see app-sidenav.tsx for the same pattern).
import { useConversations } from "@/features/conversations/api/use-conversations-queries";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// "25m ago" / "3h ago" / "Yesterday" / "Monday" / "12 Aug" — like the design.
function inboxTime(date?: string | null): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24 && d.getDate() === new Date().getDate()) return `${hrs}h ago`;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const daysBack = Math.ceil((startOfToday.getTime() - d.getTime()) / 86_400_000);
  if (daysBack <= 1) return "Yesterday";
  if (daysBack < 7) return WEEKDAYS[d.getDay()];
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function MessengerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-9 w-9" aria-hidden>
      <defs>
        <linearGradient id="msgr-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00B2FF" />
          <stop offset="100%" stopColor="#006AFF" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#msgr-grad)" />
      <path
        fill="#fff"
        d="M12 4.9c-4.06 0-7.2 2.97-7.2 6.67 0 2.09.99 3.94 2.6 5.17v2.36l2.4-1.32c.7.19 1.44.3 2.2.3 4.06 0 7.2-2.97 7.2-6.67S16.06 4.9 12 4.9zm.76 8.98-1.87-2-3.64 2 4-4.25 1.92 2 3.59-2-4 4.25z"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-9 w-9" aria-hidden>
      <defs>
        <radialGradient id="ig-grad" cx="0.3" cy="1.1" r="1.3">
          <stop offset="0%" stopColor="#FFDD55" />
          <stop offset="30%" stopColor="#FF543E" />
          <stop offset="60%" stopColor="#C837AB" />
          <stop offset="100%" stopColor="#3771C8" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#ig-grad)" />
      <rect x="6.8" y="6.8" width="10.4" height="10.4" rx="3.2" fill="none" stroke="#fff" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2.5" fill="none" stroke="#fff" strokeWidth="1.5" />
      <circle cx="15.35" cy="8.65" r="0.85" fill="#fff" />
    </svg>
  );
}

function ChannelIcon({ channelType }: { channelType?: string | null }) {
  const t = (channelType || "").toLowerCase();
  if (t.includes("messenger") || t.includes("facebook")) return <MessengerIcon />;
  if (t.includes("instagram")) return <InstagramIcon />;
  if (t.includes("email") || t.includes("mail")) {
    return (
      <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-500 text-white">
        <Mail className="h-4.5 w-4.5" />
      </span>
    );
  }
  return (
    <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500 text-white">
      <MessageCircle className="h-4.5 w-4.5" />
    </span>
  );
}

function contactName(c: any): string {
  const contact = c.contact as Record<string, any> | null | undefined;
  return (
    contact?.name ||
    [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") ||
    c.subject ||
    "Unknown contact"
  );
}

function agentInitials(c: any): string {
  const u = c.assigned_user as Record<string, any> | null | undefined;
  const name =
    [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.name || u?.username || "";
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p: string) => p[0]?.toUpperCase())
      .join("") || "—"
  );
}

function statusPill(c: any): { label: string; className: string } | null {
  if (c.needs_reply) return { label: "Needs Reply", className: "bg-red-500 text-white" };
  if ((c.status || "").toLowerCase() === "closed")
    return { label: "Closed", className: "bg-emerald-600 text-white" };
  return null;
}

export function ConversationsTab() {
  const [, navigate] = useLocation();
  const { data } = useConversations({ pageSize: 8 });
  const conversations = data?.items ?? [];

  return (
    <div className="flex min-h-[300px] flex-col" data-testid="panel-dashboard-conversations">
      <div className="flex-1 space-y-2">
        {conversations.length === 0 ? (
          <div
            className="rounded-lg border border-dashed border-black/10 p-8 text-center text-xs text-black/45 dark:border-white/10 dark:text-white/45"
            data-testid="empty-dashboard-conversations"
          >
            No conversations yet
          </div>
        ) : (
          conversations.map((c) => {
            const name = contactName(c);
            const preview = c.last_message?.text || c.subject || "";
            const pill = statusPill(c);
            return (
              <div
                key={c.id}
                role="link"
                tabIndex={0}
                onClick={() => navigate("/conversations")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate("/conversations");
                  }
                }}
                className="group flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                data-testid={`row-dashboard-conversation-${c.id}`}
              >
                <ChannelIcon channelType={c.channel_type} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-medium">{name}</span>
                    <span className="shrink-0 text-xs font-semibold text-[#fe9a00]">
                      - {inboxTime(c.last_message_at || c.created_at)}
                    </span>
                  </div>
                  {preview && (
                    <div className="mt-0.5 truncate pl-2 text-[13px] text-[#a195a5] dark:text-white/40">
                      {preview}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2 self-center">
                  {pill && (
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        pill.className,
                      )}
                      data-testid={`pill-dashboard-conversation-${c.id}`}
                    >
                      {pill.label}
                    </span>
                  )}
                  <span
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-400"
                    aria-hidden
                  >
                    {agentInitials(c)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate("/conversations");
                    }}
                    className="grid h-7 w-7 place-items-center rounded-full text-black/50 transition hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
                    aria-label="Open conversation"
                  >
                    <Ellipsis className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 border-t border-black/5 pt-3 dark:border-white/5">
        <Link
          href="/conversations"
          className="text-sm font-semibold text-[#fe9a00] hover:underline"
          data-testid="link-view-all-conversations"
        >
          Open Inbox
        </Link>
      </div>
    </div>
  );
}

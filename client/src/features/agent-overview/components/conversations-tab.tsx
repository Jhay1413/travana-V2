import { Link, useLocation } from "wouter";
import { ChevronRight } from "lucide-react";
// Deep import on purpose — the conversations feature barrel pulls the whole
// inbox into the bundle (see app-sidenav.tsx for the same pattern).
import { useConversations } from "@/features/conversations/api/use-conversations-queries";
import { InitialsAvatar, timeAgo } from "./dashboard-ui";

function contactName(c: any): string {
  const contact = c.contact as Record<string, any> | null | undefined;
  return (
    contact?.name ||
    [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") ||
    c.subject ||
    "Unknown contact"
  );
}

export function ConversationsTab() {
  const [, navigate] = useLocation();
  const { data } = useConversations({ status: "open", assignedTo: "me_and_unassigned", pageSize: 8 });
  const conversations = data?.items ?? [];

  return (
    <div className="flex min-h-[300px] flex-col" data-testid="panel-dashboard-conversations">
      <div className="flex-1 space-y-1">
        {conversations.length === 0 ? (
          <div
            className="rounded-lg border border-dashed border-black/10 p-8 text-center text-xs text-black/45 dark:border-white/10 dark:text-white/45"
            data-testid="empty-dashboard-conversations"
          >
            No open conversations
          </div>
        ) : (
          conversations.map((c) => {
            const name = contactName(c);
            const preview =
              (c.last_message as any)?.preview ||
              (c.last_message as any)?.body_preview ||
              c.subject ||
              "";
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
                className="group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                data-testid={`row-dashboard-conversation-${c.id}`}
              >
                <InitialsAvatar name={name} className="h-8 w-8 text-[11px]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-semibold">{name}</span>
                    <span className="shrink-0 text-xs text-black/40 dark:text-white/40">
                      {timeAgo(c.last_message_at || c.created_at)}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-black/50 dark:text-white/50">
                    {preview}
                  </div>
                </div>
                {c.needs_reply && (
                  <span className="shrink-0 rounded-sm bg-red-500 px-2.5 py-1 text-[11px] font-semibold text-white">
                    Needs reply
                  </span>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-black/30 transition group-hover:translate-x-0.5 dark:text-white/30" />
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4">
        <Link
          href="/conversations"
          className="text-sm font-semibold text-amber-500 hover:underline"
          data-testid="link-view-all-conversations"
        >
          Open Inbox
        </Link>
      </div>
    </div>
  );
}

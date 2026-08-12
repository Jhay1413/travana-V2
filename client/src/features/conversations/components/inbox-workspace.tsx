import { useMemo, useState } from "react";
import { MessageSquare, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCommentCapabilities } from "../api/use-comments";
import ConversationsInbox from "./conversations-inbox";
import { CommentsPanel } from "./comments-panel";

type WorkspaceTab = "messages" | "comments";

/**
 * The inbox shell: DMs and social comments side by side under one switch.
 *
 * The two views are siblings rather than one merged list because a comment
 * isn't a conversation — it has its own lifecycle, a hard 7-day reply
 * deadline, and exactly one reply available. Folding it into the conversation
 * list would put a row there that most of the list's actions (snooze, close,
 * assign, thread view) don't apply to.
 */
export function InboxWorkspace() {
  const [tab, setTab] = useState<WorkspaceTab>("messages");

  // Comments are a per-workspace Beta feature on SendSeven, so the tab is
  // hidden unless the org actually has a comment-capable channel. An empty
  // queue with no explanation reads as a bug; a missing tab reads as "not for
  // us", which is the truth. Errors (403 feature_not_enabled) hide it too.
  const { data: capabilities } = useCommentCapabilities();
  const commentsAvailable = useMemo(
    () => (capabilities?.items ?? []).some((c) => c.supports_comments !== false),
    [capabilities],
  );

  // Never strand the user on a hidden tab if capabilities load late or change.
  const active: WorkspaceTab = tab === "comments" && !commentsAvailable ? "messages" : tab;

  return (
    <div className="space-y-3">
      {commentsAvailable && (
        <div className="flex items-center gap-1 rounded-2xl border border-black/8 bg-black/[0.02] p-1 dark:border-white/8 dark:bg-white/[0.03] w-fit">
          {(
            [
              { key: "messages" as const, label: "Messages", Icon: MessageSquare },
              { key: "comments" as const, label: "Comments", Icon: MessagesSquare },
            ]
          ).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                active === key
                  ? "bg-white text-black shadow-sm dark:bg-white/10 dark:text-white"
                  : "text-black/50 hover:text-black/70 dark:text-white/50 dark:hover:text-white/70",
              )}
              data-testid={`workspace-tab-${key}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Hidden rather than unmounted. The inbox holds per-conversation local
          state that lives only in the component — unsent drafts above all — so
          remounting it on every tab switch would quietly throw away an agent's
          half-typed reply. */}
      <div className={cn(active !== "messages" && "hidden")}>
        <ConversationsInbox />
      </div>
      {commentsAvailable && (
        <div className={cn(active !== "comments" && "hidden")}>
          <CommentsPanel />
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Ban,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  Instagram,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  PRIVATE_REPLY_MAX_LENGTH,
  canSendPrivateReply,
  privateReplyBlockedReason,
  type SsComment,
  type SsCommentStateFilter,
} from "../api/comments.api";
import { useComments, usePrivateReply, useTriageComment } from "../api/use-comments";

const PAGE_SIZE = 25;

// The queue an agent works through, not every state SendSeven reports.
// `auto_replied` is folded into "Answered": from the desk's point of view the
// comment is done and its one private reply is spent, regardless of who spent it.
const QUEUE_TABS = [
  { key: "unanswered", label: "Unanswered", states: ["unanswered"] as SsCommentStateFilter[] },
  { key: "answered", label: "Answered", states: ["replied", "auto_replied"] as SsCommentStateFilter[] },
  { key: "done", label: "Handled", states: ["handled", "ignored"] as SsCommentStateFilter[] },
] as const;

type QueueTabKey = (typeof QUEUE_TABS)[number]["key"];

function authorLabel(comment: SsComment): string {
  const author = comment.author;
  // Instagram gives a handle, Facebook gives a display name, and neither gives
  // both — so this picks whichever exists rather than preferring one.
  return author?.username ? `@${author.username}` : (author?.name ?? "Unknown");
}

function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  const mins = Math.round((Date.now() - ts) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * How long is left to send the one private reply Meta allows.
 *
 * Renders nothing once the window is closed — the reply box shows the reason in
 * that case, and a "0h left" chip next to a disabled box would just say it twice.
 */
function windowLabel(comment: SsComment): string | null {
  const expiry = comment.private_reply_window_expires_at;
  if (!expiry) return null;
  const ms = Date.parse(expiry) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d left`;
  if (hours >= 1) return `${hours}h left`;
  return `${Math.max(1, Math.round(ms / 60_000))}m left`;
}

function StateChip({ comment }: { comment: SsComment }) {
  const state = comment.state;
  const map: Record<string, { label: string; className: string }> = {
    auto_replied: { label: "Auto-replied", className: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
    replied: { label: "Replied", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    handled: { label: "Handled", className: "bg-black/5 text-black/50 dark:bg-white/5 dark:text-white/50" },
    ignored: { label: "Ignored", className: "bg-black/5 text-black/40 dark:bg-white/5 dark:text-white/40" },
  };
  const chip = state ? map[state] : undefined;
  if (!chip) return null;
  return (
    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", chip.className)}>{chip.label}</span>
  );
}

function CommentRow({
  comment,
  selected,
  onSelect,
}: {
  comment: SsComment;
  selected: boolean;
  onSelect: () => void;
}) {
  const remaining = windowLabel(comment);
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full border-b border-black/5 px-4 py-3 text-left transition dark:border-white/5",
        selected ? "bg-black/[0.04] dark:bg-white/[0.06]" : "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
      )}
      data-testid={`comment-row-${comment.id}`}
    >
      <div className="flex items-center gap-2">
        <span className="truncate text-xs font-semibold">{authorLabel(comment)}</span>
        <StateChip comment={comment} />
        <span className="ml-auto flex-shrink-0 text-[10px] text-black/35 dark:text-white/35">
          {timeAgo(comment.created_at)}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-black/60 dark:text-white/60">{comment.text || "(no text)"}</p>
      {remaining && (
        <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
          <Clock className="h-3 w-3" /> {remaining}
        </span>
      )}
    </button>
  );
}

function ReplyBox({ comment }: { comment: SsComment }) {
  const [text, setText] = useState("");
  const { toast } = useToast();
  const privateReply = usePrivateReply();

  const blocked = privateReplyBlockedReason(comment);
  const canSend = canSendPrivateReply(comment);
  const tooLong = text.length > PRIVATE_REPLY_MAX_LENGTH;

  const send = () => {
    const body = text.trim();
    if (!body || tooLong) return;
    privateReply.mutate(
      { id: comment.id, input: { text: body, channel_id: comment.channel_id } },
      {
        onSuccess: () => {
          setText("");
          toast({ title: "Private reply sent", description: `Your DM to ${authorLabel(comment)} is on its way.` });
        },
        // The server maps 409/410/422 to a plain-English reason; surface it as
        // written rather than a generic failure, because every one of them
        // means "this can never be sent" and the agent needs to know which.
        onError: (err: unknown) => {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            "Couldn't send the private reply.";
          toast({ title: "Private reply failed", description: message, variant: "destructive" });
        },
      },
    );
  };

  if (blocked) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-3 text-xs text-black/50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/50">
        <Ban className="h-3.5 w-3.5 flex-shrink-0" />
        {blocked}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white/60 p-2 dark:border-white/10 dark:bg-white/[0.04]">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Send a private DM to ${authorLabel(comment)}…`}
        rows={3}
        className="resize-none border-0 bg-transparent text-sm focus-visible:ring-0"
        data-testid="comment-reply-input"
      />
      <div className="flex items-center gap-2 px-2 pb-1">
        <span
          className={cn(
            "text-[10px] tabular-nums",
            tooLong ? "font-semibold text-red-500" : "text-black/35 dark:text-white/35",
          )}
        >
          {text.length}/{PRIVATE_REPLY_MAX_LENGTH}
        </span>
        {/* Stated plainly, every time. This is the single most surprising rule
            in the feature and it is unrecoverable once spent. */}
        <span className="text-[10px] text-black/35 dark:text-white/35">· one reply per comment, ever</span>
        <Button
          size="sm"
          onClick={send}
          disabled={!canSend || !text.trim() || tooLong || privateReply.isPending}
          className="ml-auto h-8 rounded-xl text-xs"
          data-testid="comment-reply-send"
        >
          {privateReply.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          <span className="ml-1.5">Send private reply</span>
        </Button>
      </div>
    </div>
  );
}

function CommentDetail({ comment }: { comment: SsComment }) {
  const { toast } = useToast();
  const triage = useTriageComment();
  const isOpen = comment.state !== "handled" && comment.state !== "ignored";

  const setState = (state: "handled" | "ignored" | "pending", label: string) => {
    triage.mutate(
      { id: comment.id, state },
      {
        onSuccess: () => toast({ title: label }),
        onError: () => toast({ title: `Couldn't mark this comment as ${state}`, variant: "destructive" }),
      },
    );
  };

  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-amber-400 text-white">
          <Instagram className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{authorLabel(comment)}</span>
            <StateChip comment={comment} />
          </div>
          <span className="text-[11px] text-black/40 dark:text-white/40">
            {timeAgo(comment.created_at)}
            {comment.is_reply && " · reply to another comment"}
          </span>
        </div>
        {comment.post?.permalink && (
          <a
            href={comment.post.permalink}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-xl px-2 py-1 text-[11px] text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/5"
          >
            View post <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="rounded-2xl bg-black/[0.03] px-4 py-3 text-sm dark:bg-white/[0.05]">
        {comment.text || <span className="text-black/40 dark:text-white/40">(no text)</span>}
      </div>

      {comment.post?.caption && (
        <div className="rounded-2xl border border-black/8 px-4 py-3 dark:border-white/8">
          <span className="text-[10px] font-bold uppercase tracking-wide text-black/35 dark:text-white/35">
            On this post
          </span>
          <p className="mt-1 line-clamp-3 text-xs text-black/60 dark:text-white/60">{comment.post.caption}</p>
        </div>
      )}

      <div className="mt-auto space-y-3">
        <ReplyBox comment={comment} />
        <div className="flex items-center gap-2">
          {/* Triage clears the queue WITHOUT spending the private reply — the
              only way to deal with a comment that needs no DM. */}
          {isOpen ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setState("handled", "Marked as handled")}
                disabled={triage.isPending}
                className="h-8 rounded-xl text-xs"
                data-testid="comment-mark-handled"
              >
                <CheckCheck className="mr-1.5 h-3.5 w-3.5" /> Mark handled
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setState("ignored", "Comment ignored")}
                disabled={triage.isPending}
                className="h-8 rounded-xl text-xs text-black/50 dark:text-white/50"
                data-testid="comment-ignore"
              >
                <Ban className="mr-1.5 h-3.5 w-3.5" /> Ignore
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setState("pending", "Reopened")}
              disabled={triage.isPending}
              className="h-8 rounded-xl text-xs"
              data-testid="comment-reopen"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Reopen
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The Comments queue: Instagram/Facebook post comments and the one private
 * reply each can receive.
 *
 * Kept as its own two-pane view rather than a fourth status tab in the
 * conversation list, because a comment is not a conversation: it has a
 * different lifecycle (pending → replied/handled/ignored), a hard 7-day reply
 * deadline, and no thread to scroll.
 */
export function CommentsPanel() {
  const [tab, setTab] = useState<QueueTabKey>("unanswered");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const states = useMemo(() => QUEUE_TABS.find((t) => t.key === tab)?.states ?? [], [tab]);
  const { data, isLoading, isError, refetch } = useComments({
    state: states,
    includePost: true,
    includeReply: true,
    sortOrder: "desc",
    page,
    pageSize: PAGE_SIZE,
  });

  const items = data?.items ?? [];
  const pagination = data?.pagination;
  // Resolve the selection out of the live list rather than holding a snapshot:
  // a realtime refetch must update the open comment's state, or the reply box
  // would stay enabled after someone else answered it.
  const selected = items.find((c) => c.id === selectedId) ?? null;

  const switchTab = (key: QueueTabKey) => {
    setTab(key);
    setPage(1);
    setSelectedId(null);
  };

  return (
    <section
      className="grid h-[calc(100vh-8rem)] gap-4"
      style={{ gridTemplateColumns: "360px 1fr" }}
      data-testid="section-comments"
    >
      <Card className="glass ringed grain flex flex-col overflow-hidden rounded-3xl p-0">
        <div className="flex items-center gap-6 border-b border-black/8 px-4 pt-3 dark:border-white/8">
          {QUEUE_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => switchTab(t.key)}
              className={cn(
                "relative pb-2 text-xs font-bold uppercase tracking-wide transition",
                tab === t.key ? "text-black dark:text-white" : "text-black/40 hover:text-black/60 dark:text-white/40",
              )}
              data-testid={`comment-tab-${t.key}`}
            >
              {t.label}
              {tab === t.key && pagination && pagination.total > 0 && (
                <span className="ml-1 text-black/40 dark:text-white/40">{pagination.total}</span>
              )}
              {tab === t.key && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-black dark:bg-white" />
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-black/30 dark:text-white/30">
              <Loader2 className="h-7 w-7 animate-spin" />
              <span className="text-xs">Loading comments…</span>
            </div>
          ) : isError ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center text-black/40 dark:text-white/40">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <span className="text-sm font-medium">Couldn't load comments</span>
              <span className="text-xs">
                The Comments feature may not be enabled for this workspace yet.
              </span>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-1 h-8 rounded-xl text-xs">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center text-black/35 dark:text-white/35">
              <MessageCircle className="h-8 w-8" />
              <span className="text-sm font-medium">Nothing here</span>
              <span className="text-xs">
                {tab === "unanswered" ? "Every comment has been dealt with." : "No comments in this view yet."}
              </span>
            </div>
          ) : (
            items.map((c) => (
              <CommentRow key={c.id} comment={c} selected={selectedId === c.id} onSelect={() => setSelectedId(c.id)} />
            ))
          )}
        </div>

        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between border-t border-black/8 px-4 py-2 text-xs dark:border-white/8">
            <Button
              variant="ghost"
              size="sm"
              disabled={!pagination.has_prev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-7 rounded-xl text-xs"
            >
              Previous
            </Button>
            <span className="text-black/40 dark:text-white/40">
              {pagination.page} / {pagination.total_pages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={!pagination.has_next}
              onClick={() => setPage((p) => p + 1)}
              className="h-7 rounded-xl text-xs"
            >
              Next
            </Button>
          </div>
        )}
      </Card>

      <Card className="glass ringed grain flex flex-col overflow-hidden rounded-3xl p-0">
        {selected ? (
          <CommentDetail comment={selected} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-black/30 dark:text-white/30">
            <Sparkles className="h-8 w-8" />
            <span className="text-sm">Select a comment to reply</span>
            <span className="max-w-xs text-center text-xs">
              A private reply turns a public comment into a DM. Meta allows one per comment, within 7 days.
            </span>
          </div>
        )}
      </Card>
    </section>
  );
}

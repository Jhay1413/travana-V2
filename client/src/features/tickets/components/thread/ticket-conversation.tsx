import { useLayoutEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/queries";
import { useRoles } from "@/hooks/use-role";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useReplies } from "@/features/reply";
import { useAttachments, useDeleteAttachment } from "@/features/attachment";
import type { TicketAttachment } from "@/features/attachment";
import type { User as ApiUser } from "@/features/user/types";
import { ATTACHMENT_ADMIN_ROLES, canDeleteAttachment } from "../../lib/attachment-access";
import { ticketErrorMessage } from "../../lib/error-message";
import { buildThread, groupByDay, type ThreadItem, type ThreadNote } from "../../lib/thread-model";
import type { Ticket } from "../../types";
import { ReplyComposer } from "../composer/reply-composer";
import { ReplyThreadToggle } from "../reply-thread-toggle";
import { NoteDayDivider, noteDayLabel } from "./day-groups";
import { ThreadNoteCard } from "./thread-note";
import { useNoteActions } from "./use-note-actions";

/** The centre of the ticket page: the description and notes as day-grouped full-width messages (replies nest), then the composer. */
export function TicketConversation({ ticket, users, compact = false }: { ticket: Ticket; users: ApiUser[]; compact?: boolean }) {
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const { hasAnyRole } = useRoles();
  const isAdmin = hasAnyRole([...ATTACHMENT_ADMIN_ROLES]);
  const { data: replies, isLoading } = useReplies(ticket.id);
  const { data: attachments } = useAttachments(ticket.id);
  const deleteAttachment = useDeleteAttachment(ticket.id);
  const { replyingTo, setReplyingTo, collapsed, toggleReplies, actionsFor } = useNoteActions(ticket);

  const hasTicketFiles = (attachments ?? []).some((a) => a.replyId === null);
  const thread = useMemo(() => buildThread(ticket, replies, users, hasTicketFiles), [ticket, replies, users, hasTicketFiles]);
  // The description and every top-level note are full-width messages under day dividers; only real replies nest.
  const groups = useMemo(() => groupByDay(thread, noteDayLabel), [thread]);
  const noteCount = (replies?.length ?? 0) + (ticket.description || hasTicketFiles ? 1 : 0);

  // Opens at the newest note and follows it down when another lands.
  const scrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [ticket.id, noteCount]);

  const isMine = (userId: string) => !!currentUser?.id && currentUser.id === userId;

  // Attachments grouped by the reply they were posted with; null is the ticket-level group.
  const attachmentsByReply = useMemo(() => {
    const map = new Map<string | null, TicketAttachment[]>();
    for (const a of attachments ?? []) {
      const list = map.get(a.replyId) ?? [];
      list.push(a);
      map.set(a.replyId, list);
    }
    return map;
  }, [attachments]);
  const attachmentsFor = (note: ThreadNote) => attachmentsByReply.get(note.reply ? note.reply.id : null) ?? [];

  const onDeleteAttachmentFor = (note: ThreadNote) =>
    canDeleteAttachment({ userId: currentUser?.id, isAdmin, ticketUserId: ticket.userId, replyAuthorId: note.reply?.userId ?? null })
      ? (id: string) =>
          deleteAttachment.mutate(id, {
            onError: (err) => toast({ title: ticketErrorMessage(err, "Failed to delete attachment"), variant: "destructive" }),
          })
      : undefined;
  const deletingAttachmentId = deleteAttachment.isPending ? (deleteAttachment.variables ?? null) : null;

  const renderItem = ({ note, children }: ThreadItem, nested: boolean) => (
    <div key={note.id} className="space-y-3">
      <ThreadNoteCard
        note={note}
        nested={nested}
        isMe={isMine(note.authorId)}
        actions={actionsFor(note, note.id)}
        attachments={attachmentsFor(note)}
        onDeleteAttachment={onDeleteAttachmentFor(note)}
        deletingAttachmentId={deletingAttachmentId}
        footer={
          children.length > 0 ? (
            <ReplyThreadToggle
              count={children.length}
              collapsed={collapsed.has(note.id)}
              onToggle={() => toggleReplies(note.id)}
              data-testid={`ticket-note-replies-toggle-${note.id}`}
            />
          ) : undefined
        }
      />
      {/* Replies hang off one rail under the note they answer and can be folded away. */}
      {children.length > 0 && !collapsed.has(note.id) && (
        <div className="ml-8 space-y-3 border-l-2 border-social-border pl-4 sm:ml-16" data-testid={`ticket-note-replies-${note.id}`}>
          {children.map((child) => (
            <ThreadNoteCard
              key={child.id}
              note={child}
              nested
              isMe={isMine(child.authorId)}
              actions={actionsFor(child, note.id)}
              attachments={attachmentsFor(child)}
              onDeleteAttachment={onDeleteAttachmentFor(child)}
              deletingAttachmentId={deletingAttachmentId}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div
        ref={scrollRef}
        role="log"
        aria-label="Conversation"
        className={cn("no-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto bg-muted/40", compact ? "p-4" : "p-5")}
        data-testid="ticket-conversation"
      >
        {isLoading && thread.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-social-muted">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-[12px]">Loading conversation…</span>
          </div>
        ) : thread.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[13px] text-social-muted">No activity on this ticket yet</div>
        ) : (
          // The description is the first top-level item, so its day divider is the first group's: no duplicate.
          groups.map((group, gi) => (
            <div key={gi} className="space-y-4">
              <NoteDayDivider label={group.day} />
              {group.items.map((item) => renderItem(item, false))}
            </div>
          ))
        )}
      </div>
      <ReplyComposer key={ticket.id} ticketId={ticket.id} replyingTo={replyingTo} onCancelReplyTo={() => setReplyingTo(null)} onSent={() => setReplyingTo(null)} />
    </>
  );
}

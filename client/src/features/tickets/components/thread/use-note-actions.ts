import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDeleteReply, useToggleReplyLike, useUpdateReply } from "@/features/reply";
import { useToggleTicketLike, useUpdateTicket } from "../../api/use-ticket-mutations";
import { ticketErrorMessage } from "../../lib/error-message";
import type { ThreadNote } from "../../lib/thread-model";
import type { Ticket } from "../../types";
import type { NoteActions } from "./thread-note";

/** Who a new reply is answering, shown above the composer. */
export interface ReplyTarget {
  authorName: string;
  /** Top-level reply id the new reply nests under (none for the ticket itself). */
  parentReplyId?: string;
}

/** Per-note UI state and handlers (like, reply, edit, delete) for one ticket's conversation. */
export function useNoteActions(ticket: Ticket) {
  const { toast } = useToast();
  const updateTicket = useUpdateTicket();
  const updateReply = useUpdateReply(ticket.id);
  const deleteReply = useDeleteReply(ticket.id);
  const toggleReplyLike = useToggleReplyLike(ticket.id);
  const toggleTicketLike = useToggleTicketLike();
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Per-note UI state belongs to one ticket; drop it when another is opened.
  useEffect(() => {
    setReplyingTo(null);
    setEditingId(null);
    setConfirmDeleteId(null);
    setCollapsed(new Set());
  }, [ticket.id]);

  const toggleReplies = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const fail = (fallback: string) => (err: unknown) => toast({ title: ticketErrorMessage(err, fallback), variant: "destructive" });

  /**
   * Handlers for one note. Replies to a nested reply attach to its top-level
   * parent (threads are one level deep) but still name the person answered.
   */
  const actionsFor = (note: ThreadNote, topLevelId: string): NoteActions => {
    const reply = note.reply;
    if (!reply) {
      // The ticket description: likes and edits go through the ticket itself,
      // a reply to it is a top-level reply, and it is deleted from the menu.
      return {
        canDelete: false,
        onLike: () => toggleTicketLike.mutate(ticket.id, { onError: fail("Failed to update like") }),
        isLiking: toggleTicketLike.isPending && toggleTicketLike.variables === ticket.id,
        onReply: () => setReplyingTo({ authorName: note.authorName }),
        onEdit: () => setEditingId(note.id),
        onDelete: () => undefined,
        isEditing: editingId === note.id,
        onSaveEdit: (content) =>
          updateTicket.mutate(
            { id: ticket.id, data: { description: content } },
            { onSuccess: () => setEditingId(null), onError: fail("Failed to update ticket") },
          ),
        onCancelEdit: () => setEditingId(null),
        isSavingEdit: updateTicket.isPending && updateTicket.variables?.id === ticket.id && editingId === note.id,
        isConfirmingDelete: false,
        onConfirmDelete: () => undefined,
        onCancelDelete: () => undefined,
      };
    }
    return {
      canDelete: true,
      onLike: () => toggleReplyLike.mutate(reply.id, { onError: fail("Failed to update like") }),
      isLiking: toggleReplyLike.isPending && toggleReplyLike.variables === reply.id,
      onReply: () => setReplyingTo({ authorName: note.authorName, parentReplyId: topLevelId }),
      onEdit: () => setEditingId(reply.id),
      onDelete: () => setConfirmDeleteId(reply.id),
      isEditing: editingId === reply.id,
      onSaveEdit: (content) =>
        updateReply.mutate({ id: reply.id, content }, { onSuccess: () => setEditingId(null), onError: fail("Failed to update reply") }),
      onCancelEdit: () => setEditingId(null),
      isSavingEdit: updateReply.isPending && updateReply.variables?.id === reply.id,
      isConfirmingDelete: confirmDeleteId === reply.id,
      onConfirmDelete: () =>
        deleteReply.mutate(reply.id, { onSuccess: () => setConfirmDeleteId(null), onError: fail("Failed to delete reply") }),
      onCancelDelete: () => setConfirmDeleteId(null),
    };
  };

  return { replyingTo, setReplyingTo, collapsed, toggleReplies, actionsFor };
}

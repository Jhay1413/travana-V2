import type { ReactNode } from "react";
import { Heart, Pencil, Reply as ReplyIcon, Trash2 } from "lucide-react";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { RichTextDisplay } from "@/components/shared/rich-text-editor";
import { formatFullDateTime } from "@/lib/note-time";
import { cn } from "@/lib/utils";
import type { TicketAttachment } from "@/features/attachment";
import type { ThreadNote } from "../../lib/thread-model";
import { TicketAttachmentList } from "../ticket-attachment-list";
import { NoteEditForm } from "./note-edit-form";

export interface NoteActions {
  /** Replies can be deleted from the thread; the ticket itself is deleted from its menu. */
  canDelete: boolean;
  onLike: () => void;
  isLiking: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isEditing: boolean;
  onSaveEdit: (content: string) => void;
  onCancelEdit: () => void;
  isSavingEdit: boolean;
  isConfirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

const ACTION = "flex items-center gap-1 text-[12px] font-medium text-social-muted transition hover:text-foreground";

/** One team note: avatar, author and time, the body, attachments and the like / reply / edit / delete row. */
export function ThreadNoteCard({
  note,
  isMe,
  nested = false,
  actions,
  footer,
  attachments,
  onDeleteAttachment,
  deletingAttachmentId,
}: {
  note: ThreadNote;
  isMe: boolean;
  /** Rendered under a parent note. */
  nested?: boolean;
  /** Absent for read-only rendering. */
  actions?: NoteActions;
  /** Rendered under the card, inside its column (for example the replies toggle). */
  footer?: ReactNode;
  attachments?: TicketAttachment[];
  /** Present only when the viewer may remove attachments from this note. */
  onDeleteAttachment?: (id: string) => void;
  deletingAttachmentId?: string | null;
}) {
  const isEdited = !!note.updatedAt && Date.parse(note.updatedAt) > Date.parse(note.createdAt) + 1000;

  return (
    <div className={cn("flex gap-3", nested && "text-[13px]")}>
      {note.authorImage ? (
        <img src={note.authorImage} alt="" className={cn("shrink-0 rounded-full object-cover", nested ? "h-7 w-7" : "h-8 w-8")} />
      ) : (
        <PersonAvatar name={note.authorName} size={nested ? 28 : 32} />
      )}
      <div className="min-w-0 flex-1">
        <div
          className={cn("rounded-2xl border border-social-border px-4 py-3", isMe ? "bg-pipeline-task-bg" : "bg-card")}
          data-testid={`ticket-note-${note.id}`}
        >
          <div className="mb-1 flex flex-wrap items-baseline gap-x-2 text-[12px]">
            <span className="text-[13px] font-semibold">{note.authorName}</span>
            <span className="text-social-muted">
              {formatFullDateTime(note.createdAt)}
              {isEdited ? " (edited)" : ""}
            </span>
          </div>
          {actions?.isEditing ? (
            <NoteEditForm initial={note.content} onSave={actions.onSaveEdit} onCancel={actions.onCancelEdit} isSaving={actions.isSavingEdit} />
          ) : (
            <div className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">
              <RichTextDisplay content={note.content} />
            </div>
          )}
          {!actions?.isEditing && attachments && attachments.length > 0 && (
            <TicketAttachmentList attachments={attachments} onDelete={onDeleteAttachment} deletingId={deletingAttachmentId} compact />
          )}
          {actions && !actions.isEditing && (
            <div className="mt-2 flex items-center gap-3.5">
              {actions.isConfirmingDelete ? (
                <span className="flex items-center gap-1.5 text-[12px]">
                  Delete this reply?
                  <button type="button" onClick={actions.onConfirmDelete} className="font-semibold text-status-failed-fg hover:underline" data-testid={`ticket-note-delete-confirm-${note.id}`}>
                    Yes
                  </button>
                  <button type="button" onClick={actions.onCancelDelete} className="font-semibold hover:underline">
                    No
                  </button>
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={actions.onLike}
                    disabled={actions.isLiking}
                    className={cn(ACTION, "hover:text-status-failed-fg disabled:opacity-60", note.likedByMe && "text-status-failed-fg")}
                    data-testid={`ticket-note-like-${note.id}`}
                  >
                    <Heart className={cn("h-3.5 w-3.5", note.likedByMe && "fill-current")} />
                    {note.likeCount > 0 ? note.likeCount : null}
                  </button>
                  <button type="button" onClick={actions.onReply} className={ACTION} data-testid={`ticket-note-reply-${note.id}`}>
                    <ReplyIcon className="h-3.5 w-3.5" /> Reply
                  </button>
                  {isMe && (
                    <>
                      <button type="button" onClick={actions.onEdit} className={ACTION} data-testid={`ticket-note-edit-${note.id}`}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      {actions.canDelete && (
                        <button type="button" onClick={actions.onDelete} className={cn(ACTION, "hover:text-status-failed-fg")} data-testid={`ticket-note-delete-${note.id}`}>
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        {footer}
      </div>
    </div>
  );
}

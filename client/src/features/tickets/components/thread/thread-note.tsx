import type { ReactNode } from "react";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { RichTextDisplay } from "@/components/shared/rich-text-editor";
import { formatFullDateTime } from "@/lib/note-time";
import { cn } from "@/lib/utils";
import type { TicketAttachment } from "@/features/attachment";
import type { ThreadNote } from "../../lib/thread-model";
import { TicketAttachmentList } from "../ticket-attachment-list";
import { NoteEditForm } from "./note-edit-form";
import { NoteHeaderActions } from "./note-header-actions";

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
    <div className={cn("group/note flex gap-3", nested && "max-w-[85%] text-[13px]")}>
      {note.authorImage ? (
        <img src={note.authorImage} alt="" className={cn("shrink-0 rounded-full object-cover", nested ? "h-7 w-7" : "h-8 w-8")} />
      ) : (
        <PersonAvatar name={note.authorName} size={nested ? 28 : 32} />
      )}
      <div className="min-w-0 flex-1">
        <div
          className={cn("rounded-2xl border border-social-border", nested ? "px-3 py-2" : "px-4 py-3", isMe ? "bg-pipeline-task-bg" : "bg-card")}
          data-testid={`ticket-note-${note.id}`}
        >
          <div className="mb-1 flex flex-wrap items-center gap-x-2 text-[12px]">
            <span className="text-[13px] font-semibold">{note.authorName}</span>
            <span className="text-social-muted">
              {formatFullDateTime(note.createdAt)}
              {isEdited ? " (edited)" : ""}
            </span>
            {actions && <NoteHeaderActions note={note} isMe={isMe} actions={actions} />}
          </div>
          {actions?.isEditing ? (
            <NoteEditForm initial={note.content} onSave={actions.onSaveEdit} onCancel={actions.onCancelEdit} isSaving={actions.isSavingEdit} />
          ) : (
            <div className={cn("whitespace-pre-wrap break-words leading-relaxed", nested ? "text-[13px]" : "text-[14px]")}>
              <RichTextDisplay content={note.content} />
            </div>
          )}
          {!actions?.isEditing && attachments && attachments.length > 0 && (
            <TicketAttachmentList attachments={attachments} onDelete={onDeleteAttachment} deletingId={deletingAttachmentId} compact />
          )}
        </div>
        {footer}
      </div>
    </div>
  );
}

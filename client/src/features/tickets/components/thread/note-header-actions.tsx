import type { ReactNode } from "react";
import { Heart, Pencil, Reply as ReplyIcon, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ThreadNote } from "../../lib/thread-model";
import type { NoteActions } from "./thread-note";

const ICON_BUTTON =
  "inline-flex h-6 min-w-6 items-center justify-center gap-1 rounded-md px-1 text-[12px] font-medium text-social-muted transition hover:bg-muted hover:text-foreground disabled:opacity-60";

function IconAction({ label, children, className, ...props }: { label: string; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={label} className={cn(ICON_BUTTON, className)} {...props}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Like / reply / edit / delete for a note, icon-only and right-aligned in its header.
 * Hidden until the note is hovered or focused; always shown on touch devices and while
 * the delete confirmation is open.
 */
export function NoteHeaderActions({ note, isMe, actions }: { note: ThreadNote; isMe: boolean; actions: NoteActions }) {
  if (actions.isEditing) return null;
  const reveal =
    "opacity-0 transition-opacity group-hover/note:opacity-100 group-focus-within/note:opacity-100 [@media(hover:none)]:opacity-100";

  if (actions.isConfirmingDelete) {
    return (
      <span className="ml-auto flex items-center gap-1.5 text-[12px]">
        Delete this reply?
        <button type="button" onClick={actions.onConfirmDelete} className="font-semibold text-status-failed-fg hover:underline" data-testid={`ticket-note-delete-confirm-${note.id}`}>
          Yes
        </button>
        <button type="button" onClick={actions.onCancelDelete} className="font-semibold hover:underline">
          No
        </button>
      </span>
    );
  }

  return (
    <span className={cn("ml-auto flex items-center gap-0.5", reveal, note.likedByMe && "opacity-100")}>
      <IconAction
        label={note.likedByMe ? "Unlike" : "Like"}
        onClick={actions.onLike}
        disabled={actions.isLiking}
        className={cn("hover:text-status-failed-fg", note.likedByMe && "text-status-failed-fg")}
        data-testid={`ticket-note-like-${note.id}`}
      >
        <Heart className={cn("h-3.5 w-3.5", note.likedByMe && "fill-current")} />
        {note.likeCount > 0 ? note.likeCount : null}
      </IconAction>
      <IconAction label="Reply" onClick={actions.onReply} data-testid={`ticket-note-reply-${note.id}`}>
        <ReplyIcon className="h-3.5 w-3.5" />
      </IconAction>
      {isMe && (
        <>
          <IconAction label="Edit" onClick={actions.onEdit} data-testid={`ticket-note-edit-${note.id}`}>
            <Pencil className="h-3.5 w-3.5" />
          </IconAction>
          {actions.canDelete && (
            <IconAction label="Delete" onClick={actions.onDelete} className="hover:text-status-failed-fg" data-testid={`ticket-note-delete-${note.id}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </IconAction>
          )}
        </>
      )}
    </span>
  );
}

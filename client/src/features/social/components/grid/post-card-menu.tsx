import { useState } from "react";
import { CalendarClock, MoreHorizontal, Pencil, RotateCcw, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { SocialPostStatus } from "@/features/social/lib/post-status";
import { deleteCopy } from "./card-fields";

interface PostCardMenuProps {
  quoteId: string;
  status: SocialPostStatus;
  postSchedule: string | null | undefined;
  busy: boolean;
  onEdit: () => void;
  onSchedule: () => void;
  onMoveToDrafts: () => void;
  onDelete: () => void;
}

type Confirm = "drafts" | "delete" | null;

/** Overflow menu on a card: edit, schedule, move back to drafts, delete. */
export function PostCardMenu({ quoteId, status, postSchedule, busy, onEdit, onSchedule, onMoveToDrafts, onDelete }: PostCardMenuProps) {
  const [confirm, setConfirm] = useState<Confirm>(null);
  const hasPost = status !== "not_generated";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-[10px] border-social-border bg-card text-social-muted" aria-label="More actions" data-testid={`button-card-menu-${quoteId}`}>
            <MoreHorizontal className="h-[18px] w-[18px]" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {hasPost && (
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              {status === "posted" ? "Post again" : "Edit post"}
            </DropdownMenuItem>
          )}
          {(status === "draft" || status === "scheduled") && (
            <DropdownMenuItem onSelect={onSchedule}>
              <CalendarClock className="mr-2 h-4 w-4" />
              {status === "draft" ? "Schedule…" : "Change time…"}
            </DropdownMenuItem>
          )}
          {status === "scheduled" && (
            <DropdownMenuItem onSelect={() => setConfirm("drafts")}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Move back to drafts
            </DropdownMenuItem>
          )}
          {hasPost && <DropdownMenuSeparator />}
          <DropdownMenuItem onSelect={() => setConfirm("delete")} className="text-red-600 focus:text-red-600">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "drafts" ? "Move back to drafts?" : "Delete this post?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "drafts" ? "It will not go out until you schedule it again." : deleteCopy(status, postSchedule)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => (confirm === "drafts" ? onMoveToDrafts() : onDelete())}
              className={confirm === "delete" ? "bg-red-600 text-white hover:bg-red-700" : undefined}
            >
              {confirm === "drafts" ? "Move to drafts" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

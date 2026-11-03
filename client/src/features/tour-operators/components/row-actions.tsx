import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OUTLINE_ACTION } from "@/features/pipeline/shared/button-styles";
import { cn } from "@/lib/utils";
import type { OrgOperatorRow } from "../types";
import { ICON_ACTION, SMALL_BUTTON } from "./classes";

interface RowActionsProps {
  row: OrgOperatorRow;
  confirming: boolean;
  busy: boolean;
  onEdit: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

/** Edit pencil and delete bin; delete confirms inline ("Delete {name}?"), no modal. */
export function RowActions({ row, confirming, busy, onEdit, onAskDelete, onCancelDelete, onConfirmDelete }: RowActionsProps) {
  if (confirming) {
    return (
      <span className="flex items-center justify-end gap-2" role="group" aria-label={`Confirm delete ${row.name}`}>
        <span className="text-[12px]">Delete {row.name}?</span>
        <Button type="button" disabled={busy} onClick={onConfirmDelete} className={cn(SMALL_BUTTON, "bg-status-failed-fg text-primary-foreground hover:bg-status-failed-fg/90")} data-testid={`confirm-delete-${row.linkId}`}>
          Delete
        </Button>
        <Button type="button" variant="outline" onClick={onCancelDelete} className={cn(OUTLINE_ACTION, SMALL_BUTTON, "h-8")}>
          Cancel
        </Button>
      </span>
    );
  }
  return (
    <span className="flex items-center justify-end gap-1.5">
      <button type="button" onClick={onEdit} aria-label={`Edit ${row.name}`} title="Edit" className={cn(ICON_ACTION, "hover:text-social-navy")} data-testid={`edit-${row.linkId}`}>
        <Pencil className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" onClick={onAskDelete} aria-label={`Delete ${row.name}`} title="Delete" className={cn(ICON_ACTION, "hover:bg-status-failed-bg hover:text-status-failed-fg")} data-testid={`delete-${row.linkId}`}>
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </span>
  );
}

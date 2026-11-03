import { Archive, Eye, KeyRound, MoreHorizontal, Pause, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface MemberMenuProps {
  name: string;
  userId: string;
  suspended: boolean;
  isSelf: boolean;
  isAdmin: boolean;
  isHomeworker: boolean;
  /** Archive is only offered when the homeworker list has this person (not already archived). */
  canArchive: boolean;
  onView: () => void;
  onPermissions: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onRemove: () => void;
  onArchive: () => void;
}

/**
 * The three-dot menu (borderless trigger). Nothing destructive for yourself or for
 * branch-manager viewers; homeworkers are archived rather than removed.
 */
export function MemberRowMenu(p: MemberMenuProps) {
  const manage = p.isAdmin && !p.isSelf;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-[30px] w-[30px] text-social-muted hover:text-foreground"
          aria-label={`More actions for ${p.name}`}
          data-testid={`menu-member-${p.userId}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 text-[13px]">
        <DropdownMenuItem onSelect={p.onView}>
          <Eye className="mr-2 h-4 w-4" /> View details
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={p.onPermissions}>
          <KeyRound className="mr-2 h-4 w-4" /> View permissions
        </DropdownMenuItem>
        {manage && p.suspended && (
          <DropdownMenuItem onSelect={p.onReactivate} data-testid={`action-reactivate-${p.userId}`}>
            <Play className="mr-2 h-4 w-4 text-status-scheduled-fg" /> Reactivate
          </DropdownMenuItem>
        )}
        {manage && !p.suspended && (
          <DropdownMenuItem onSelect={p.onSuspend} className="text-ticket-amber-fg" data-testid={`action-suspend-${p.userId}`}>
            <Pause className="mr-2 h-4 w-4" /> Suspend
          </DropdownMenuItem>
        )}
        {manage && !p.isHomeworker && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={p.onRemove} className="text-stage-lost-fg" data-testid={`action-remove-${p.userId}`}>
              <Trash2 className="mr-2 h-4 w-4" /> Remove user
            </DropdownMenuItem>
          </>
        )}
        {manage && p.isHomeworker && p.canArchive && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={p.onArchive} className="text-stage-lost-fg" data-testid={`action-archive-${p.userId}`}>
              <Archive className="mr-2 h-4 w-4" /> Archive homeworker
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

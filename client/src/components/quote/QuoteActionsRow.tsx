import { Copy, FileText, MoreHorizontal, Pencil, RefreshCw, Ticket, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface QuoteActionsRowProps {
  pageLabel: string;
  canConvert: boolean;
  isAdmin: boolean;
  onEdit: () => void;
  onConvert: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onTicket: () => void;
  onDelete: () => void;
}

export function QuoteActionsRow({
  pageLabel,
  canConvert,
  isAdmin,
  onEdit,
  onConvert,
  onDuplicate,
  onExport,
  onTicket,
  onDelete,
}: QuoteActionsRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="row-quote-actions">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-9 rounded-2xl border-black/10 bg-white/70"
            data-testid="button-quote-actions"
          >
            <MoreHorizontal className="mr-2 h-4 w-4" />
            Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 rounded-xl">
          <DropdownMenuItem onClick={onEdit} data-testid="button-quote-edit">
            <Pencil className="mr-2 h-4 w-4" />
            Edit {pageLabel}
          </DropdownMenuItem>
          {canConvert && (
            <DropdownMenuItem onClick={onConvert} data-testid="button-quote-convert">
              <RefreshCw className="mr-2 h-4 w-4" />
              Convert to Booking
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onDuplicate} data-testid="button-quote-duplicate">
            <Copy className="mr-2 h-4 w-4" />
            Duplicate {pageLabel}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExport} data-testid="button-export-quote">
            <FileText className="mr-2 h-4 w-4" />
            Export
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onTicket} data-testid="button-quote-ticket">
            <Ticket className="mr-2 h-4 w-4" />
            Ticket
          </DropdownMenuItem>
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-red-600 focus:bg-red-50 focus:text-red-600"
                data-testid="button-quote-admin-delete"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete {pageLabel}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

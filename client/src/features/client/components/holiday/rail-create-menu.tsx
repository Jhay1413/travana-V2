import { CalendarCheck, FileText, ListTodo, MessageSquare, Plus, Ticket } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HOLIDAY_ICON_BTN_BLUE } from "@/features/client/components/holiday/holiday-styles";

export type RailCreateKind = "enquiry" | "quote" | "booking" | "task" | "ticket";

const ITEM = "gap-2 rounded-[10px] text-sm";

/** The round blue "+" of the rail; opens the same create menu the old All holidays panel had. */
export function RailCreateMenu({ onCreate }: { onCreate: (kind: RailCreateKind) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={HOLIDAY_ICON_BTN_BLUE} aria-label="New holiday" title="New holiday" data-testid="holidays-rail-new">
          <Plus className="size-[18px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-[10px]">
        <DropdownMenuItem onClick={() => onCreate("enquiry")} className={ITEM} data-testid="holidays-rail-new-enquiry">
          <MessageSquare className="size-4" /> Create Enquiry
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCreate("quote")} className={ITEM} data-testid="holidays-rail-new-quote">
          <FileText className="size-4" /> Create Quote
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCreate("booking")} className={ITEM} data-testid="holidays-rail-new-booking">
          <CalendarCheck className="size-4" /> Create Booking
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onCreate("task")} className={ITEM} data-testid="holidays-rail-new-task">
          <ListTodo className="size-4" /> Create Task
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCreate("ticket")} className={ITEM} data-testid="holidays-rail-new-ticket">
          <Ticket className="size-4" /> Create Ticket
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

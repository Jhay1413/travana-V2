import type { ReactNode } from "react";
import { CalendarCheck, FileText, MessageSquare } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ClientDealKind } from "@/features/client/types";

/**
 * Menu behind every "Add deal" / "New deal" button: the three things a deal can
 * start as, so quote and booking creation stay reachable from the client page.
 */
export function NewDealMenu({
  trigger,
  onCreate,
  align = "end",
  testIdPrefix,
}: {
  trigger: ReactNode;
  onCreate: (kind: ClientDealKind) => void;
  align?: "start" | "end";
  testIdPrefix: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-48">
        <DropdownMenuItem onClick={() => onCreate("enquiry")} className="gap-2" data-testid={`${testIdPrefix}-enquiry`}>
          <MessageSquare className="h-4 w-4" /> Create enquiry
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCreate("quote")} className="gap-2" data-testid={`${testIdPrefix}-quote`}>
          <FileText className="h-4 w-4" /> Create quote
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCreate("booking")} className="gap-2" data-testid={`${testIdPrefix}-booking`}>
          <CalendarCheck className="h-4 w-4" /> Create booking
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

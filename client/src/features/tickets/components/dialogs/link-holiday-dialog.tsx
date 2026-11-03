import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useUpdateTicket } from "../../api/use-ticket-mutations";
import { ticketErrorMessage } from "../../lib/error-message";
import type { Ticket } from "../../types";
import { HolidayPicker } from "./holiday-picker";

/** "Link a holiday" dialog opened from the ticket page's More menu: attach one of this client's holidays. */
export function LinkHolidayDialog({ ticket, open, onOpenChange }: { ticket: Ticket; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const updateTicket = useUpdateTicket();
  const [selection, setSelection] = useState("");

  // Reseed from the ticket's current link each time the dialog opens.
  useEffect(() => {
    if (open) setSelection(ticket.transactionId ?? "");
  }, [open, ticket.transactionId]);

  const save = () => {
    if (!selection) return;
    updateTicket.mutate(
      { id: ticket.id, data: { transactionId: selection } },
      {
        onSuccess: () => {
          toast({ title: "Holiday linked" });
          onOpenChange(false);
        },
        onError: (err) => toast({ title: ticketErrorMessage(err, "Failed to link holiday"), variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Link to a holiday</DialogTitle>
          <DialogDescription>Attach one of this client&apos;s holidays to the ticket.</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <HolidayPicker clientId={ticket.clientId} value={selection} onChange={setSelection} testId="link-holiday-select" allowNone={false} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="link-holiday-cancel">
            Cancel
          </Button>
          <Button onClick={save} disabled={!selection || updateTicket.isPending} data-testid="link-holiday-save">
            {updateTicket.isPending ? "Linking…" : "Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

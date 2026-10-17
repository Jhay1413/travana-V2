import { useState } from "react";
import { Info, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useUpdateTicket } from "../../api/use-ticket-mutations";
import { ticketErrorMessage } from "../../lib/error-message";
import type { Ticket } from "../../types";
import { useHolidayOptions } from "../dialogs/holiday-picker";
import { InfoNote, PanelShell } from "./panel-parts";

/** No holiday on the ticket: the client's own holidays with a Link button each, and a note that leaving it empty is fine. */
export function NoBookingPanel({ ticket, className }: { ticket: Ticket; className?: string }) {
  const { toast } = useToast();
  const updateTicket = useUpdateTicket();
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const options = useHolidayOptions(ticket.clientId, !!ticket.clientId);

  const link = (transactionId: string) => {
    setLinkingId(transactionId);
    updateTicket.mutate(
      { id: ticket.id, data: { transactionId } },
      {
        onSuccess: () => toast({ title: "Holiday linked" }),
        onError: (err) => toast({ title: ticketErrorMessage(err, "Failed to link holiday"), variant: "destructive" }),
        onSettled: () => setLinkingId(null),
      },
    );
  };

  return (
    <PanelShell label="Booking" className={className}>
      <div className="min-h-0 flex-1 overflow-y-auto" data-testid="ticket-no-booking-panel">
        <div className="mx-[18px] mt-5 rounded-2xl border-[1.5px] border-dashed border-ticket-dashed bg-pipeline-money-bg px-5 py-6 text-center">
          <span className="inline-grid h-[52px] w-[52px] place-items-center rounded-[14px] bg-muted">
            <Link2 className="h-6 w-6 text-social-muted" strokeWidth={1.8} />
          </span>
          <div className="mt-3 text-[15px] font-semibold">No booking linked</div>
          <p className="mt-1 text-[12px] leading-normal text-social-muted">
            {ticket.clientId
              ? "This ticket is not about a specific trip. If it is, link a holiday and its details will show here."
              : "Internal tickets are not tied to a client, so there is no holiday to link."}
          </p>
        </div>

        {ticket.clientId && (
          <div className="px-[18px] pt-[18px]">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted">This client&apos;s holidays</div>
            <div className="flex flex-col gap-2">
              {options.map((o) => (
                <div key={o.id} className="flex items-center gap-2.5 rounded-xl border border-social-border px-3 py-2" data-testid={`ticket-holiday-option-${o.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{o.title}</div>
                    <div className="text-[12px] text-social-muted">{o.label.split(" · ")[0]}</div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn("h-8 rounded-[10px] border-social-border bg-card px-3.5 text-[12.5px]")}
                    disabled={linkingId !== null}
                    onClick={() => link(o.id)}
                    data-testid={`ticket-link-holiday-${o.id}`}
                  >
                    {linkingId === o.id ? "Linking…" : "Link"}
                  </Button>
                </div>
              ))}
              {options.length === 0 && <div className="text-[12px] text-social-muted">No holidays on file for this client.</div>}
            </div>
          </div>
        )}

        <div className="p-[18px]">
          <InfoNote icon={<Info className="h-4 w-4" strokeWidth={2} />}>
            You can also leave it. Tickets about logins, marketing or general questions do not need a holiday.
          </InfoNote>
        </div>
      </div>
    </PanelShell>
  );
}

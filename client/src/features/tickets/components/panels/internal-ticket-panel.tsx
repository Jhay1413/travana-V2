import { LifeBuoy } from "lucide-react";
import { PanelShell } from "./panel-parts";

/** Client column for tickets with no client (Build tickets). */
export function InternalTicketPanel({ className }: { className?: string }) {
  return (
    <PanelShell label="Client" className={className}>
      <div className="grid flex-1 place-items-center p-6 text-center" data-testid="ticket-internal-panel">
        <div>
          <span className="inline-grid h-[52px] w-[52px] place-items-center rounded-[14px] bg-muted">
            <LifeBuoy className="h-6 w-6 text-social-muted" strokeWidth={1.8} />
          </span>
          <div className="mt-3 text-[15px] font-semibold">Internal ticket</div>
          <p className="mt-1 text-[12px] leading-normal text-social-muted">This is an internal ticket, so no client is linked.</p>
        </div>
      </div>
    </PanelShell>
  );
}

import { Link2, Mail, Phone, Search } from "lucide-react";
import { PersonAvatar } from "@/components/shared/person-avatar";
import type { PickedClient } from "../../../lib/raw-client";
import { DuePill } from "../../shared/due-pill";
import { KindTag } from "../../shared/kind-tag";
import { PriorityBadge } from "../../shared/priority-badge";
import { StatusBadge } from "../../shared/status-badge";
import { useHolidayOptions } from "../holiday-picker";
import type { NewTicketFormState } from "./use-new-ticket-form";

const CARD = "rounded-2xl border border-social-border bg-card";

/** Right-hand column of the dialog: what the ticket will look like once it exists. */
export function NewTicketPreview({ form, now }: { form: NewTicketFormState; now: Date }) {
  const client: PickedClient | null = form.client;
  const options = useHolidayOptions(client?.id, !!client);
  const holiday = options.find((o) => o.id === form.transactionId);

  return (
    <aside className="hidden w-[380px] flex-none overflow-y-auto border-l border-social-border bg-muted/40 px-6 py-5 lg:block" data-testid="new-ticket-preview">
      <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted">What the ticket will show</div>

      <div className={`${CARD} mb-3 p-4`}>
        <div className="mb-2.5 flex items-center gap-1.5">
          <KindTag type={form.type} />
          <StatusBadge status={form.status} />
        </div>
        <div className="break-words text-[15px] font-semibold">{form.subject.trim() || "Subject of the ticket"}</div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <PriorityBadge priority={form.priority} />
          <DuePill ticket={{ dueDate: form.dueDate, status: form.status }} now={now} />
        </div>
      </div>

      {form.type === "Build" ? (
        <div className="rounded-[14px] border-[1.5px] border-dashed border-ticket-dashed bg-card px-4 py-3.5 text-[12.5px] text-social-muted">
          Build tickets are internal, so there is no client or holiday on them.
        </div>
      ) : !client ? (
        <div className="rounded-2xl border-[1.5px] border-dashed border-ticket-dashed bg-card px-6 py-9 text-center">
          <span className="inline-grid h-[52px] w-[52px] place-items-center rounded-[14px] bg-muted">
            <Search className="h-6 w-6 text-social-muted" strokeWidth={1.8} />
          </span>
          <div className="mt-3 text-[15px] font-semibold">Pick a client</div>
          <p className="mt-1.5 text-[12px] leading-normal text-social-muted">Their contact details and linked holiday will show here, and on the ticket itself.</p>
        </div>
      ) : (
        <>
          <div className={`${CARD} mb-3 p-4`}>
            <div className="mb-2.5 flex items-center gap-3">
              <PersonAvatar name={client.name} size={44} />
              <div className="min-w-0 text-[15px] font-semibold">{client.name}</div>
            </div>
            {client.phone && (
              <div className="flex items-center gap-2.5 py-1 text-[13px] font-semibold">
                <Phone className="h-[15px] w-[15px] text-social-muted" />
                {client.phone}
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-2.5 py-1 text-[13px]">
                <Mail className="h-[15px] w-[15px] text-social-muted" />
                <span className="break-all">{client.email}</span>
              </div>
            )}
          </div>
          {holiday ? (
            <div className={`${CARD} p-4`}>
              <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted">Holiday</div>
              <div className="mt-1 text-[14px] font-semibold">{holiday.title}</div>
              <div className="text-[12px] text-social-muted">{holiday.label.split(" · ")[0]}</div>
            </div>
          ) : (
            <div className="flex gap-2 rounded-[14px] border-[1.5px] border-dashed border-ticket-dashed bg-card px-4 py-3.5 text-[12.5px] text-social-muted">
              <Link2 className="mt-0.5 h-[15px] w-[15px] shrink-0" strokeWidth={2} />
              No holiday linked. You can link one later from the ticket.
            </div>
          )}
        </>
      )}
    </aside>
  );
}

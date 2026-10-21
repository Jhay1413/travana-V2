import { useState } from "react";
import { Copy, Pencil } from "lucide-react";
import { useUpdateBooking } from "@/features/booking/api/use-booking-mutations";
import type { EnrichedBooking } from "@/features/quote/types";
import { formatUKDate } from "@/features/quote/components/quote-types";
import { useToast } from "@/hooks/use-toast";
import { RefsForm } from "@/features/client/components/holiday/refs-form";
import { HOLIDAY_BTN_GHOST, HOLIDAY_BTN_PRIMARY, HOLIDAY_ICON_BTN } from "@/features/client/components/holiday/holiday-styles";

/**
 * "Booking references" card of a booking: HAYS Ref and Supplier Ref with copy buttons,
 * an empty state with "Add references", and an edit form that saves through the booking update.
 *
 * Props:
 * - booking: the booking detail response (hays_ref, supplier_ref, date_created, owner_name, operator name).
 * - ownerName: overrides booking.owner_name in "Booked {date} by {name}".
 * - operatorName: overrides booking.main_tour_operator_name in the Supplier Ref labels.
 * - readOnly: hides Add references and Edit (copy still works).
 */
export interface RefsCardProps {
  booking: EnrichedBooking;
  ownerName?: string | null;
  operatorName?: string | null;
  readOnly: boolean;
}

const CARD =
  "rounded-2xl border border-qp-refs-border bg-gradient-to-b from-qp-refs-from to-qp-refs-to p-[22px] max-[620px]:p-4";

export function RefsCard({ booking, ownerName, operatorName, readOnly }: RefsCardProps) {
  const [editing, setEditing] = useState(false);
  const { toast } = useToast();
  const update = useUpdateBooking();
  const hays = booking.hays_ref?.trim() ?? "";
  const supplier = booking.supplier_ref?.trim() ?? "";
  const hasRefs = Boolean(hays || supplier);
  const operator = operatorName ?? booking.main_tour_operator_name ?? null;
  const owner = ownerName ?? booking.owner_name ?? null;
  const bookedLine = [
    booking.date_created ? `Booked ${formatUKDate(booking.date_created)}` : null,
    owner ? `by ${owner}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied` });
    } catch {
      toast({ title: value });
    }
  }

  function save(value: { haysRef: string; supplierRef: string }) {
    update.mutate(
      { id: booking.id, data: { hays_ref: value.haysRef, supplier_ref: value.supplierRef } },
      {
        onSuccess: () => {
          setEditing(false);
          toast({ title: "References saved" });
        },
        onError: () => toast({ title: "Could not save the references", variant: "destructive" }),
      },
    );
  }

  if (!hasRefs && !editing) {
    return (
      <section className={CARD} aria-labelledby="holiday-refs-title" data-testid="holiday-refs-card">
        <h2 id="holiday-refs-title" className="text-base font-semibold">
          Booking references
        </h2>
        <p className="mb-3 mt-1 text-[13px] text-qp-muted">No references yet.</p>
        {!readOnly && (
          <button type="button" className={HOLIDAY_BTN_PRIMARY} onClick={() => setEditing(true)} data-testid="holiday-refs-add">
            Add references
          </button>
        )}
      </section>
    );
  }

  return (
    <section className={CARD} aria-labelledby="holiday-refs-title" data-testid="holiday-refs-card">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="holiday-refs-title" className="text-base font-semibold">
            Booking references
          </h2>
          {bookedLine && <p className="mt-0.5 text-[13px] text-qp-muted">{bookedLine}</p>}
        </div>
        {!editing && !readOnly && (
          <button type="button" className={HOLIDAY_BTN_GHOST} onClick={() => setEditing(true)} data-testid="holiday-refs-edit">
            <Pencil className="size-3.5" aria-hidden />
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <RefsForm
          initial={{ haysRef: hays, supplierRef: supplier }}
          operatorName={operator}
          pending={update.isPending}
          onCancel={() => setEditing(false)}
          onSave={save}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3.5 max-[620px]:grid-cols-1">
          <RefBox label="HAYS Ref" hint="Your booking reference" value={hays} onCopy={copy} />
          <RefBox label="Supplier Ref" hint={operator ? `${operator} booking reference` : "Supplier booking reference"} value={supplier} onCopy={copy} />
        </div>
      )}
    </section>
  );
}

function RefBox({ label, hint, value, onCopy }: { label: string; hint: string; value: string; onCopy: (label: string, value: string) => void }) {
  return (
    <div className="relative flex min-w-0 flex-col gap-0.5 rounded-[10px] border border-social-border bg-card py-3.5 pl-4 pr-14">
      <span className="text-xs font-semibold uppercase tracking-wide text-qp-profit-fg">{label}</span>
      <b className="break-words text-[22px] font-semibold tracking-wide text-social-navy">{value || "Not set"}</b>
      <span className="text-[13px] text-qp-muted">{hint}</span>
      {value && (
        <button
          type="button"
          className={`${HOLIDAY_ICON_BTN} absolute right-3 top-1/2 -translate-y-1/2`}
          aria-label={`Copy ${label}`}
          title={`Copy ${label}`}
          onClick={() => onCopy(label, value)}
        >
          <Copy className="size-4" />
        </button>
      )}
    </div>
  );
}

import { useState } from "react";
import { Copy } from "lucide-react";
import type { EnrichedBooking } from "@/features/quote/types";
import { formatUKDate } from "@/features/quote/components/quote-types";
import { useToast } from "@/hooks/use-toast";
import { RefsDialog } from "@/features/client/components/holiday/refs-dialog";
import { HOLIDAY_BTN_GHOST } from "@/features/client/components/holiday/holiday-styles";

/**
 * Booking references as chips in the booking hero: HAYS Ref and Supplier Ref with copy buttons,
 * a muted empty line, and an "Edit refs" / "Add references" button that opens RefsDialog.
 *
 * Props:
 * - booking: the booking detail response.
 * - readOnly: hides the edit button (copy still works).
 */
export interface RefChipsProps {
  booking: EnrichedBooking;
  readOnly: boolean;
}

export function RefChips({ booking, readOnly }: RefChipsProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const hays = booking.hays_ref?.trim() ?? "";
  const supplier = booking.supplier_ref?.trim() ?? "";
  const hasRefs = Boolean(hays || supplier);
  const booked = [
    booking.date_created ? `Booked ${formatUKDate(booking.date_created)}` : null,
    booking.owner_name ? `by ${booking.owner_name}` : null,
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

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-2" data-testid="holiday-refs-card">
      {hays && <Chip label="HAYS Ref" value={hays} onCopy={copy} />}
      {supplier && <Chip label="Supplier Ref" value={supplier} onCopy={copy} />}
      {!hasRefs && <span className="text-[13px] text-qp-muted">No booking references yet.</span>}
      {!readOnly && (
        <button
          type="button"
          className={HOLIDAY_BTN_GHOST}
          title={hasRefs && booked ? booked : undefined}
          onClick={() => setOpen(true)}
          data-testid={hasRefs ? "holiday-refs-edit" : "holiday-refs-add"}
        >
          {hasRefs ? "Edit refs" : "Add references"}
        </button>
      )}
      {open && <RefsDialog open={open} onOpenChange={setOpen} booking={booking} bookedLine={booked} />}
    </div>
  );
}

function Chip({ label, value, onCopy }: { label: string; value: string; onCopy: (label: string, value: string) => void }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-qp-refs-border bg-qp-refs-from px-3 py-[3px] pr-1 text-[13px]">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-qp-profit-fg">{label}</span>
      <b className="font-bold text-social-navy">{value}</b>
      <button
        type="button"
        className="grid size-7 shrink-0 place-items-center rounded-full text-qp-muted transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`Copy ${label}`}
        title={`Copy ${label}`}
        onClick={() => onCopy(label, value)}
      >
        <Copy className="size-3.5" />
      </button>
    </span>
  );
}

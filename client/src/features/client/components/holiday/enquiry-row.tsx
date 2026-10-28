import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import type { HolidayRowData } from "@/features/client/lib/live-deal-rows";

/**
 * Plain row for the Enquiry tab of the All holidays rail, as in the reference design:
 * a soft grey block with the title, a muted note line and an "Enquiry" pill on the right.
 * Enquiries have no operator, price or photos, so the full HolidayLink card would sit
 * mostly empty.
 */
export function EnquiryRow({ row, current, onSelect }: { row: HolidayRowData; current: boolean; onSelect: () => void }) {
  const note = [row.destinationName, row.dateLine].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] transition",
        current ? "border-qp-current-border bg-qp-current-tint" : "border-transparent bg-social-page hover:bg-muted",
        "max-[1180px]:min-w-[240px]",
      )}
      data-testid={`holiday-link-${row.id}`}
    >
      <span className="min-w-0">
        <b className={cn("block truncate font-semibold", row.expired && "text-status-failed-fg")}>{row.title}</b>
        {note && <span className="block truncate text-qp-muted">{note}</span>}
      </span>
      <StatusPill tone="info" className="px-2 py-0 text-[11px] xl:text-[11px]">
        Enquiry
      </StatusPill>
    </button>
  );
}

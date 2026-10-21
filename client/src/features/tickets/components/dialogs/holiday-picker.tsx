import { useMemo } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTransactions } from "@/hooks/queries";
import { getTourOperator } from "@/features/pipeline";
import { holidayLabelOf } from "@/features/transaction";
import { groupHolidayOptions, type HolidayOption } from "../../lib/holiday-groups";
import { formatShortDate } from "../../lib/ticket-display";

export type { HolidayOption } from "../../lib/holiday-groups";

const KIND_PREFIX: Record<HolidayOption["kind"], string> = { booking: "Booking", quote: "Quote", enquiry: "Enquiry" };

/** This client's holidays (booking, quote or enquiry, whichever each transaction resolves to). */
export function useHolidayOptions(clientId: string | null | undefined, enabled = true): HolidayOption[] {
  const { data: transactions } = useTransactions({ clientId: clientId ?? undefined }, { enabled: enabled && !!clientId });
  return useMemo(() => {
    const out: HolidayOption[] = [];
    for (const t of transactions ?? []) {
      const { kind, title, date } = holidayLabelOf(t);
      if (!kind) continue;
      const when = formatShortDate(date);
      const operator = getTourOperator(t);
      out.push({
        id: t.id,
        kind,
        title,
        date: date ?? null,
        label: `${KIND_PREFIX[kind]} · ${title}${when ? ` — ${when}` : ""}`,
        ref: kind === "booking" ? t.booking?.hays_ref || t.booking?.supplier_ref || null : null,
        operatorName: operator.name,
        operatorLogoUrl: operator.logoUrl,
      });
    }
    return out;
  }, [transactions]);
}

/** Select of the client's holidays, grouped Bookings / Quotes / Enquiries; the empty value means "no holiday". */
export function HolidayPicker({
  clientId,
  value,
  onChange,
  testId = "link-holiday-select",
  allowNone = true,
}: {
  clientId: string | null | undefined;
  value: string;
  onChange: (transactionId: string) => void;
  testId?: string;
  allowNone?: boolean;
}) {
  const options = useHolidayOptions(clientId);
  const groups = useMemo(() => groupHolidayOptions(options), [options]);
  return (
    <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)}>
      <SelectTrigger className="h-10 rounded-[10px] border-social-border bg-card text-[13px]" data-testid={testId}>
        <SelectValue placeholder={options.length ? "Select a holiday (optional)" : "No holidays for this client"} />
      </SelectTrigger>
      <SelectContent className="z-[600]">
        {allowNone && <SelectItem value="none">No holiday</SelectItem>}
        {groups.map((g) => (
          <SelectGroup key={g.kind}>
            <SelectLabel className="text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted">
              {g.heading} · {g.options.length}
            </SelectLabel>
            {g.options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

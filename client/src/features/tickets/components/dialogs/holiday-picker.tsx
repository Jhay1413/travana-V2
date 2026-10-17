import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTransactions } from "@/hooks/queries";
import { holidayLabelOf } from "@/features/transaction";
import { formatShortDate } from "../../lib/ticket-display";

export interface HolidayOption {
  id: string;
  kind: "booking" | "quote" | "enquiry";
  title: string;
  date: string | null;
  /** "Booking · Majorca — 12 Jun 2026" */
  label: string;
}

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
      out.push({ id: t.id, kind, title, date: date ?? null, label: `${KIND_PREFIX[kind]} · ${title}${when ? ` — ${when}` : ""}` });
    }
    return out;
  }, [transactions]);
}

/** Select of the client's holidays; the empty value means "no holiday". */
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
  return (
    <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)}>
      <SelectTrigger className="h-10 rounded-[10px] border-social-border bg-card text-[13px]" data-testid={testId}>
        <SelectValue placeholder={options.length ? "Select a holiday (optional)" : "No holidays for this client"} />
      </SelectTrigger>
      <SelectContent className="z-[600]">
        {allowNone && <SelectItem value="none">No holiday</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

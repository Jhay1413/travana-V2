import { useEffect, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { dayLabel, formatTravelDate, isSoon } from "../../lib/day-labels";
import { lastChangeLine } from "../../lib/stamp";
import { ALL_OPTION, type ListEmpty } from "../../lib/ticket-rows";
import type { DepartureLastChange } from "../../types";

/** Flex row for the Show / search / select controls. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

export function SearchBox({ value, onChange, placeholder, testId }: { value: string; onChange: (v: string) => void; placeholder: string; testId: string }) {
  return (
    <label className="flex h-10 min-w-[220px] max-w-[380px] flex-1 items-center gap-2 rounded-[10px] border border-social-border bg-card px-3 text-social-muted focus-within:ring-2 focus-within:ring-ring">
      <Search className="h-4 w-4 shrink-0" aria-hidden />
      <span className="sr-only">Search</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testId}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-social-muted"
      />
    </label>
  );
}

export function FilterSelect({
  value,
  onChange,
  allLabel,
  options,
  label,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  allLabel: string;
  options: string[];
  label: string;
  testId: string;
}) {
  // A saved choice that is no longer in the list (rows changed) falls back to All.
  const current = value === ALL_OPTION || options.includes(value) ? value : ALL_OPTION;
  useEffect(() => {
    if (current !== value) onChange(ALL_OPTION);
  }, [current, value, onChange]);
  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="h-10 w-[200px] rounded-[10px] border-social-border bg-card px-3 text-[13px] shadow-none" aria-label={label} data-testid={testId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_OPTION} className="text-[13px]">
          {allLabel}
        </SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o} className="text-[13px]">
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function LastChange({ change }: { change: DepartureLastChange | null }) {
  return <span className="block text-[12px] text-social-muted">{lastChangeLine(change)}</span>;
}

/** "Sat 17 Oct" over "Today" / "Tomorrow" / "In N days" (amber when leaving soon and not done). */
export function WhenCell({ travelDate, days, done, soonLimit = 3 }: { travelDate: string; days: number; done: boolean; soonLimit?: number }) {
  return (
    <div>
      <b className="block text-[13px] font-semibold tabular-nums">{formatTravelDate(travelDate)}</b>
      <span className={cn("text-[12px]", isSoon(days, done, soonLimit) ? "font-semibold text-stage-inplay-fg" : "text-social-muted")}>{dayLabel(days)}</span>
    </div>
  );
}

export function ListEmptyState({ empty }: { empty: ListEmpty }) {
  return (
    <div className="flex flex-col items-center gap-1 py-10 text-center text-[13px] text-social-muted" data-testid="departures-empty">
      <b className="text-[14px] font-semibold text-foreground">{empty.title}</b>
      <span>{empty.hint}</span>
    </div>
  );
}

/** Heading block of a list card: title, live status line. */
export function ListHead({ id, title, status, testId }: { id: string; title: string; status: string; testId: string }) {
  return (
    <div>
      <h2 className="text-[15px] font-semibold xl:text-base" id={id}>
        {title}
      </h2>
      <p className="mt-0.5 text-[12px] text-social-muted xl:text-[13px]" role="status" data-testid={testId}>
        {status}
      </p>
    </div>
  );
}

export const LIST_CARD = "flex min-w-0 flex-col gap-4 rounded-2xl border border-social-border bg-card p-4 xl:p-[22px]";
export const TH = "px-2 py-2.5 text-left align-bottom text-[12px] font-semibold text-social-muted";
export const TH_CENTER = "w-[78px] px-2 py-2.5 text-center align-bottom text-[12px] font-semibold text-social-muted";
export const TD = "px-2 py-3 align-middle text-[13px]";
export const TD_CENTER = "px-2 py-1.5 text-center align-middle";

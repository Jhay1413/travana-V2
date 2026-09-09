import * as React from "react";
import { format, parse, parseISO, isValid } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  /** ISO date (yyyy-MM-dd). Other common formats are parsed on a best-effort basis. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** When true, dates before today can't be selected. */
  disablePast?: boolean;
  /** Earliest selectable date (yyyy-MM-dd). Handy for "To" fields that must follow "From". */
  min?: string;
  /** Latest selectable date (yyyy-MM-dd). */
  max?: string;
  /** Show a "Clear" action in the calendar footer (default true). */
  allowClear?: boolean;
  disabled?: boolean;
  id?: string;
  "data-testid"?: string;
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;

  const tryYmd = parse(value, "yyyy-MM-dd", new Date());
  if (isValid(tryYmd)) return tryYmd;

  const tryIso = parseISO(value);
  if (isValid(tryIso)) return tryIso;

  const tryDmy = parse(value, "dd/MM/yyyy", new Date());
  if (isValid(tryDmy)) return tryDmy;

  const native = new Date(value);
  if (isValid(native)) return native;

  return undefined;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * The date field used across every form: a button showing dd/MM/yyyy that
 * opens a calendar with month/year dropdowns and Today / Clear shortcuts.
 * Values are exchanged as yyyy-MM-dd strings.
 */
function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  disablePast = false,
  min,
  max,
  allowClear = true,
  disabled = false,
  id,
  "data-testid": testId,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedDate = React.useMemo(() => parseDate(value), [value]);

  // Midnight today, so "today" itself stays selectable.
  const minDate = React.useMemo(() => {
    const fromProp = parseDate(min);
    const fromPast = disablePast ? startOfToday() : undefined;
    if (fromProp && fromPast) return fromProp > fromPast ? fromProp : fromPast;
    return fromProp ?? fromPast;
  }, [disablePast, min]);
  const maxDate = React.useMemo(() => parseDate(max), [max]);

  const disabledMatchers = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];

  const pick = (date: Date | undefined) => {
    onChange(date ? format(date, "yyyy-MM-dd") : "");
    setOpen(false);
  };

  const today = startOfToday();
  const todayAllowed = (!minDate || today >= minDate) && (!maxDate || today <= maxDate);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          data-testid={testId}
          data-empty={!selectedDate}
          className={cn(
            "h-10 w-full justify-start rounded-xl border-black/10 bg-white/70 px-3 text-left text-sm font-normal hover:bg-white/80",
            !selectedDate && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          {selectedDate ? format(selectedDate, "dd/MM/yyyy") : <span className="opacity-50">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[9999] w-auto rounded-2xl border-black/10 p-0 shadow-xl"
        align="start"
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={pick}
          defaultMonth={selectedDate ?? today}
          disabled={disabledMatchers.length ? disabledMatchers : undefined}
        />
        <div className="flex items-center justify-between gap-2 border-t border-black/[0.06] px-3 py-2">
          <button
            type="button"
            onClick={() => pick(today)}
            disabled={!todayAllowed}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="date-picker-today"
          >
            Today
          </button>
          {allowClear && (
            <button
              type="button"
              onClick={() => pick(undefined)}
              disabled={!selectedDate}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-black/55 transition hover:bg-black/[0.05] hover:text-black/80 disabled:cursor-not-allowed disabled:opacity-40"
              data-testid="date-picker-clear"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker };

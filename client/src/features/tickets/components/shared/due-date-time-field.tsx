import { useMemo } from "react";
import { Clock } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { isoToLondonParts, londonDateTimeToIso, quarterHourSlots } from "../../lib/london-datetime";
import { isLegacyDateOnly, parseTicketDue } from "../../lib/ticket-due";

const DEFAULT_TIME = "09:00";
const SLOTS = quarterHourSlots();
const END_OF_DAY = "eod";

/**
 * Date + time picker for a ticket's reply-due instant. Works in London time and
 * emits an ISO instant (or null when the date is cleared). The time list is in
 * 15-minute steps; an off-grid existing time is kept as an extra option.
 */
export function DueDateTimeField({
  value,
  onChange,
  disabled,
  triggerClassName,
  testIdPrefix = "due",
}: {
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  disabled?: boolean;
  triggerClassName?: string;
  testIdPrefix?: string;
}) {
  const parsed = useMemo(() => parseTicketDue(value), [value]);
  const parts = useMemo(() => isoToLondonParts(parsed), [parsed]);
  // A legacy date-only value means "by the end of that day", so no time is shown for it.
  const endOfDay = !!parsed && isLegacyDateOnly(parsed);
  const date = parts?.date ?? "";
  const time = parts?.time ?? DEFAULT_TIME;
  const slots = SLOTS.includes(time) ? SLOTS : [...SLOTS, time].sort();

  const emit = (nextDate: string, nextTime: string) => {
    if (!nextDate) return onChange(null);
    onChange(londonDateTimeToIso(nextDate, nextTime));
  };

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <DatePicker
          value={date}
          onChange={(next) => emit(next, endOfDay ? DEFAULT_TIME : time)}
          disabled={disabled}
          placeholder="No due date"
          className={cn("h-[38px] rounded-[10px] border-social-border bg-card text-[13px]", triggerClassName)}
          data-testid={`${testIdPrefix}-date`}
        />
      </div>
      <Select value={endOfDay ? END_OF_DAY : time} onValueChange={(next) => next !== END_OF_DAY && emit(date, next)} disabled={disabled || !date}>
        <SelectTrigger
          className={cn("h-[38px] w-[96px] shrink-0 gap-1.5 rounded-[10px] border-social-border bg-card px-2.5 text-[13px]", triggerClassName)}
          aria-label="Due time"
          data-testid={`${testIdPrefix}-time`}
        >
          <Clock className="h-3.5 w-3.5 shrink-0 text-social-muted" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          className="z-[600] max-h-[min(16rem,var(--radix-select-content-available-height))]"
          avoidCollisions
          collisionPadding={8}
        >
          {endOfDay && (
            <SelectItem value={END_OF_DAY} className="text-[13px]">
              End of day
            </SelectItem>
          )}
          {slots.map((slot) => (
            <SelectItem key={slot} value={slot} className="text-[13px]">
              {slot}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

import { cn } from "@/lib/utils";
import { time12 } from "@/features/social/lib/schedule-time";

interface TimeShortcutChipsProps {
  /** 24-hour "HH:mm" values. */
  times: string[];
  /** Currently selected "HH:mm". */
  value: string;
  onPick: (time: string) => void;
  disabled?: boolean;
}

/** Row of pill buttons that set the schedule time in one click. */
export function TimeShortcutChips({ times, value, onPick, disabled }: TimeShortcutChipsProps) {
  if (times.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="time-shortcut-chips">
      {times.map((time) => {
        const active = time === value;
        return (
          <button
            key={time}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onPick(time)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              active
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            {time12(time)}
          </button>
        );
      })}
    </div>
  );
}

import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { TimeShortcutChips } from "../schedule/time-shortcut-chips";
import { goesOutLabel } from "@/features/social/lib/schedule-time";

interface PostEditorFooterProps {
  scheduleOn: boolean;
  onScheduleOnChange: (value: boolean) => void;
  date: string;
  time: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  timeShortcuts: string[];
  timezoneLabel?: string;
  isScheduled: boolean;
  isBusy: boolean;
  formatCount: number;
  onSaveDraft: () => void;
  onSchedule: () => void;
}

const imagesLabel = (n: number) => `${n} image${n === 1 ? "" : "s"}`;

/** Schedule switch, date/time controls and the two save actions. */
export function PostEditorFooter({
  scheduleOn,
  onScheduleOnChange,
  date,
  time,
  onDateChange,
  onTimeChange,
  timeShortcuts,
  timezoneLabel,
  isScheduled,
  isBusy,
  formatCount,
  onSaveDraft,
  onSchedule,
}: PostEditorFooterProps) {
  const local = date && time ? `${date}T${time}` : "";
  const goesOut = scheduleOn ? goesOutLabel(local) : "";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-slate-200 bg-white px-6 py-4">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <Switch checked={scheduleOn} onCheckedChange={onScheduleOnChange} data-testid="switch-schedule" />
        Schedule
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          disabled={!scheduleOn}
          className="h-9 w-40 rounded-lg"
          data-testid="input-schedule-date"
        />
        <Input
          type="time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          disabled={!scheduleOn}
          className="h-9 w-32 rounded-lg"
          data-testid="input-schedule-time"
        />
        <TimeShortcutChips times={timeShortcuts} value={time} onPick={onTimeChange} disabled={!scheduleOn} />
        {timezoneLabel && <span className="text-xs text-slate-500">{timezoneLabel}</span>}
      </div>

      {goesOut && <span className="text-xs font-medium text-slate-600">{goesOut}</span>}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onSaveDraft}
          disabled={isBusy}
          className="h-10 rounded-lg"
          data-testid="button-save-draft"
        >
          Save as draft
        </Button>
        <Button
          type="button"
          onClick={onSchedule}
          disabled={isBusy || !scheduleOn || !date || !time}
          className="h-10 gap-2 rounded-lg bg-amber-500 font-semibold text-slate-900 hover:bg-amber-600"
          data-testid="button-save-and-schedule"
        >
          {isBusy ? <Spinner className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
          {isBusy && formatCount > 0
            ? `Formatting ${imagesLabel(formatCount)} and scheduling… this can take a minute`
            : `${isScheduled ? "Save & reschedule" : "Schedule post"}${
                formatCount > 0 ? ` · formatting ${imagesLabel(formatCount)}` : ""
              }`}
        </Button>
      </div>
    </div>
  );
}

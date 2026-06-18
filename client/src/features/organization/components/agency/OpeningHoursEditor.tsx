import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { BranchOpeningHour } from "@/features/organization/api/branch.api";

export function OpeningHoursEditor({
  hours,
  onChange,
}: {
  hours: BranchOpeningHour[];
  onChange: (idx: number, patch: Partial<BranchOpeningHour>) => void;
}) {
  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10">
      {hours.map((h, i) => (
        <div
          key={h.day}
          className="flex items-center gap-3 border-b border-black/5 px-3 py-2 last:border-0 dark:border-white/10"
        >
          <div className="w-12 text-xs font-semibold uppercase tracking-wider text-black/55 dark:text-white/55">
            {h.day}
          </div>
          <Switch
            checked={h.open}
            onCheckedChange={(checked) => onChange(i, { open: checked })}
            data-testid={`switch-day-${h.day}`}
          />
          <Input
            type="time"
            value={h.openTime}
            onChange={(e) => onChange(i, { openTime: e.target.value })}
            className="h-8 w-28 text-xs"
            disabled={!h.open}
            data-testid={`input-open-${h.day}`}
          />
          <span className="text-xs text-black/40 dark:text-white/40">to</span>
          <Input
            type="time"
            value={h.closeTime}
            onChange={(e) => onChange(i, { closeTime: e.target.value })}
            className="h-8 w-28 text-xs"
            disabled={!h.open}
            data-testid={`input-close-${h.day}`}
          />
        </div>
      ))}
    </div>
  );
}

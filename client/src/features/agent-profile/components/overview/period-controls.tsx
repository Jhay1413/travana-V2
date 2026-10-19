import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERIOD_GROUP_LABEL, QUICK_PERIOD_KEYS, type PeriodGroup, type PeriodOption } from "../../lib/period";

const GROUPS: PeriodGroup[] = ["timeframe", "quarter", "month"];

/** The "Show" drop-down on its own (Earnings tab). */
export function PeriodSelect({ periods, value, onChange, testId }: { periods: PeriodOption[]; value: string; onChange: (key: string) => void; testId: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-social-muted xl:text-[13px]" id={`${testId}-label`}>
        Show
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className="h-10 w-[230px] rounded-[10px] border-social-border bg-card px-3 text-[13px] shadow-none"
          aria-labelledby={`${testId}-label`}
          data-testid={testId}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {GROUPS.map((g) => {
            const items = periods.filter((p) => p.group === g);
            if (items.length === 0) return null;
            return (
              <SelectGroup key={g}>
                <SelectLabel className="text-[12px] text-social-muted">{PERIOD_GROUP_LABEL[g]}</SelectLabel>
                {items.map((p) => (
                  <SelectItem key={p.key} value={p.key} className="text-[13px]">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Today / This week / This month beside the "Show" drop-down. */
export function PeriodControls({ periods, value, onChange }: { periods: PeriodOption[]; value: string; onChange: (key: string) => void }) {
  const quick = QUICK_PERIOD_KEYS.map((key) => ({
    value: key as string,
    label: periods.find((p) => p.key === key)?.label ?? key,
    testId: `segment-period-${key}`,
  }));
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Segmented value={value} onChange={onChange} variant="black" label="Quick choice" items={quick} />
      <PeriodSelect periods={periods} value={value} onChange={onChange} testId="select-period" />
    </div>
  );
}

import { MONTH_LABELS } from "../../lib/months";
import { parseMoney } from "../../lib/money";
import { MoneyInput } from "./money-input";

interface MonthGridProps {
  values: string[];
  /** Saved amounts: an orange dot marks a month that differs. */
  baseline?: readonly number[];
  onChange: (index: number, value: string) => void;
  errors?: Record<number, string>;
  labelPrefix: string;
  disabled?: boolean;
}

/** Twelve month boxes in a 4 x 3 grid. */
export function MonthGrid({ values, baseline, onChange, errors, labelPrefix, disabled }: MonthGridProps) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {MONTH_LABELS.map((m, i) => {
        const r = parseMoney(values[i] ?? "");
        const edited = !!baseline && (!r.ok || r.value !== (baseline[i] ?? 0));
        return (
          <div key={m}>
            <div className="mb-1 flex items-center gap-1.5 text-[12px] text-social-muted">
              {m}
              {edited && <span title="Changed" className="h-1.5 w-1.5 rounded-full bg-social-orange" />}
            </div>
            <MoneyInput
              value={values[i] ?? ""}
              onChange={(v) => onChange(i, v)}
              edited={edited}
              invalid={!!errors?.[i]}
              disabled={disabled}
              ariaLabel={`${labelPrefix} ${m}`}
              testId={`month-input-${i}`}
            />
          </div>
        );
      })}
    </div>
  );
}

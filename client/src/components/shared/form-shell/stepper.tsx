import { Minus, Plus } from "lucide-react";

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** "row" = party row with label (+ sub text); "box" = boxed single field. */
  variant?: "row" | "box";
  /** Row label (row) or accessible name (box). */
  label: string;
  /** Muted text under the row label, e.g. "Age 12+". */
  sub?: string;
  /** Goes on the numeric input, so e2e can fill it directly. */
  "data-testid"?: string;
}

/** Minus, number input, plus. The input is typeable and clamped to min/max. */
export function Stepper({ value, onChange, min = 0, max = 99, variant = "row", label, sub, "data-testid": testId }: StepperProps) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)));
  const input = (
    <input
      type="number"
      className={variant === "box" ? "fm-box-step__input" : "fm-step__input"}
      value={value}
      min={min}
      max={max}
      aria-label={label}
      data-testid={testId}
      onChange={(e) => {
        const n = e.target.valueAsNumber;
        set(Number.isNaN(n) ? min : n);
      }}
    />
  );
  const minus = (
    <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => set(value - 1)}>
      <Minus size={16} aria-hidden="true" />
    </button>
  );
  const plus = (
    <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => set(value + 1)}>
      <Plus size={16} aria-hidden="true" />
    </button>
  );
  if (variant === "box") {
    return (
      <div className="fm-box-step">
        {input}
        <span>
          {minus}
          {plus}
        </span>
      </div>
    );
  }
  return (
    <div className="fm-party__row">
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        {sub ? <div style={{ fontSize: 12, color: "#6B7686" }}>{sub}</div> : null}
      </div>
      <div className="fm-step">
        {minus}
        {input}
        {plus}
      </div>
    </div>
  );
}

export interface SegOption {
  value: string;
  label: string;
  "data-testid"?: string;
}

export interface SegProps {
  options: readonly SegOption[];
  value: string;
  onChange: (value: string) => void;
  "data-testid"?: string;
  "aria-label"?: string;
}

/** Segmented control (one of N, always one active). */
export function Seg({ options, value, onChange, "data-testid": testId, "aria-label": ariaLabel }: SegProps) {
  return (
    <div className="fm-seg" role="group" data-testid={testId} aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} data-testid={o["data-testid"]} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

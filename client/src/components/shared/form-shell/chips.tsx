export interface ChipOption {
  value: string;
  label: string;
  "data-testid"?: string;
}

interface ChipsBase {
  options: readonly ChipOption[];
  small?: boolean;
  "data-testid"?: string;
  "aria-label"?: string;
}

export interface SingleChipsProps extends ChipsBase {
  multiple?: false;
  value: string;
  /** Clicking the active chip again passes "" when `allowClear` is set. */
  onChange: (value: string) => void;
  allowClear?: boolean;
}

export interface MultiChipsProps extends ChipsBase {
  multiple: true;
  value: readonly string[];
  onChange: (value: string[]) => void;
}

/** Pill toggles: single-select (default) or multi-select (`multiple`). Uses aria-pressed. */
export function Chips(props: SingleChipsProps | MultiChipsProps) {
  const { options, small, "data-testid": testId, "aria-label": ariaLabel } = props;
  const isOn = (v: string) => (props.multiple ? props.value.includes(v) : props.value === v);
  const toggle = (v: string) => {
    if (props.multiple) {
      props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
    } else {
      props.onChange(props.value === v && props.allowClear ? "" : v);
    }
  };
  return (
    <div className="fm-chips" role="group" data-testid={testId} aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`fm-chip${small ? " fm-chip--sm" : ""}`}
          aria-pressed={isOn(o.value)}
          data-testid={o["data-testid"]}
          onClick={() => toggle(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

import { moneyText, parseMoney } from "../../lib/money";
import { MoneyInput } from "../shared/money-input";

interface PlanInputProps {
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

/** Money box that tidies "90000" into "90,000" when you leave it. */
export function PlanInput({ value, onChange, invalid, ariaLabel, disabled, className }: PlanInputProps) {
  return (
    <MoneyInput
      value={value}
      invalid={invalid}
      ariaLabel={ariaLabel}
      disabled={disabled}
      className={className}
      onChange={onChange}
      onBlur={() => {
        const r = parseMoney(value);
        if (r.ok && moneyText(r.value) !== value) onChange(moneyText(r.value));
      }}
    />
  );
}

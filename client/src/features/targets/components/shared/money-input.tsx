import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TARGETS_CONTROL } from "./targets-styles";

interface MoneyInputProps {
  value: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  ariaLabel: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Amber border for a value that differs from what is saved. */
  edited?: boolean;
  autoFocus?: boolean;
  className?: string;
  testId?: string;
}

/** Whole-pound box with a £ prefix. Typing is free-form; parseMoney decides what it means. */
export function MoneyInput({ value, onChange, onBlur, ariaLabel, disabled, invalid, edited, autoFocus, className, testId }: MoneyInputProps) {
  return (
    <div className={cn("relative", className)}>
      <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-social-muted">
        £
      </span>
      <Input
        inputMode="numeric"
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={onBlur}
        data-testid={testId}
        className={cn(
          TARGETS_CONTROL,
          "pl-6 tabular-nums",
          invalid && "border-stage-lost-dot focus-visible:ring-stage-lost-dot/30",
          !invalid && edited && "border-social-orange",
          disabled && "bg-muted text-social-muted",
        )}
      />
    </div>
  );
}

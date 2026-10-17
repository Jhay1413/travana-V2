import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface Option {
  value: string;
  label: string;
}

interface OptionSelectProps {
  value: string;
  options: Option[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
}

/** shadcn Select with the wizard's sizing, driven by a plain options array. */
export function OptionSelect({
  value,
  options,
  onValueChange,
  placeholder,
  invalid,
  disabled,
  id,
  "aria-label": ariaLabel,
  className,
}: OptionSelectProps) {
  const known = options.some((o) => o.value === value);
  return (
    <Select value={known ? value : ""} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        aria-invalid={invalid ? true : undefined}
        className={cn(
          "h-10 rounded-[10px] border-social-border bg-card px-3 text-[13px] shadow-none aria-[invalid=true]:border-status-failed-fg",
          className,
        )}
      >
        <SelectValue placeholder={placeholder ?? "Select"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-[13px]">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

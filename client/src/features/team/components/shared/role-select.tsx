import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { roleLabel } from "../../lib/role-helpers";
import { TEAM_CONTROL } from "./team-styles";

export interface RoleOption {
  value: string;
  label: string;
}

/** Role dropdown. A disabled one reads as plain dimmed text, like the "you" row in the design. */
export function RoleSelect({
  value,
  options,
  onChange,
  disabled,
  label,
  placeholder = "Select role",
  className,
  testId,
}: {
  value: string;
  options: RoleOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  label: string;
  placeholder?: string;
  className?: string;
  testId?: string;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label={label} className={cn(TEAM_CONTROL, "w-full", disabled && "opacity-60", className)} data-testid={testId}>
        <SelectValue placeholder={placeholder}>{value ? roleLabel(value) : undefined}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { BranchOption } from "../../lib/invite-rows";
import { TEAM_CONTROL } from "./team-styles";

/** Branch dropdown. Disabled shows `emptyLabel` (homeworkers get their own branch) or the locked branch. */
export function BranchSelect({
  value,
  options,
  onChange,
  disabled,
  label,
  emptyLabel = "Select branch",
  title,
  className,
  invalid,
  testId,
}: {
  value: string;
  options: BranchOption[];
  onChange: (id: string) => void;
  disabled?: boolean;
  label: string;
  emptyLabel?: string;
  title?: string;
  className?: string;
  invalid?: boolean;
  testId?: string;
}) {
  const current = options.find((o) => o.id === value);
  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        aria-label={label}
        title={title}
        aria-invalid={invalid || undefined}
        className={cn(TEAM_CONTROL, "w-full", invalid && "border-status-failed-fg", disabled && "opacity-60", className)}
        data-testid={testId}
      >
        <SelectValue placeholder={emptyLabel}>{current?.name}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
            {o.isDefault ? " (default)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

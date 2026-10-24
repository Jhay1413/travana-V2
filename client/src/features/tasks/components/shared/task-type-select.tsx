import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TASK_TYPE_OPTIONS, type TaskTypeValue } from "@/features/tasks/lib/task-types";

interface TaskTypeSelectProps {
  /** "" shows the placeholder (nothing chosen yet). */
  value: TaskTypeValue | "";
  onChange: (value: TaskTypeValue) => void;
  className?: string;
  /** Stacking class for the open list when used inside a raised dialog. */
  zClassName?: string;
  id?: string;
  "aria-label"?: string;
  placeholder?: string;
  "data-testid"?: string;
}

export function TaskTypeSelect({ value, onChange, className, zClassName, id, "aria-label": ariaLabel, placeholder = "Choose a task…", "data-testid": testId }: TaskTypeSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TaskTypeValue)}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={className} data-testid={testId}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={zClassName ?? "z-[700]"}>
        {TASK_TYPE_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

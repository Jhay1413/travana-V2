import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TASK_PRIORITY_OPTIONS, type TaskPriority } from "@/features/tasks/lib/task-priority";

interface TaskPrioritySelectProps {
  value: TaskPriority;
  onChange: (value: TaskPriority) => void;
  className?: string;
  zClassName?: string;
  id?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}

export function TaskPrioritySelect({ value, onChange, className, zClassName, id, "aria-label": ariaLabel, "data-testid": testId }: TaskPrioritySelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TaskPriority)}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={className} data-testid={testId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={zClassName ?? "z-[700]"}>
        {TASK_PRIORITY_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

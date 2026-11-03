import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { UserReassignSelect } from "@/components/ui/user-reassign-select";
import { CUSTOM_TASK_TYPE, type TaskTypeValue } from "@/features/tasks/lib/task-types";
import type { TaskPriority } from "@/features/tasks/lib/task-priority";
import { TaskTypeSelect } from "@/features/tasks/components/shared/task-type-select";
import { TaskPrioritySelect } from "@/features/tasks/components/shared/task-priority-select";

export const TASK_LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted";
export const TASK_FIELD_CLASS =
  "h-11 rounded-[10px] border-social-border bg-background px-3.5 text-[14px] shadow-none focus-visible:border-social-orange focus-visible:ring-[3px] focus-visible:ring-social-orange/20";
const SELECT_CLASS = "h-11 rounded-[10px] border-social-border bg-background px-3.5 text-[14px] shadow-none";

interface TaskFieldRowProps {
  id: string;
  label: string;
  /** Spans both grid columns. */
  wide?: boolean;
  children: ReactNode;
}

/** A labelled field row for the task modal grid. */
export function TaskFieldRow({ id, label, wide, children }: TaskFieldRowProps) {
  return (
    <div className={wide ? "col-span-2 space-y-1.5" : "space-y-1.5"}>
      <label htmlFor={id} className={TASK_LABEL_CLASS}>
        {label}
      </label>
      {children}
    </div>
  );
}

interface TaskTypeFieldProps {
  id: string;
  testId: string;
  value: TaskTypeValue | "";
  onChange: (value: TaskTypeValue) => void;
  /** Test id of the "choose a type" hint; omitted = no hint. */
  errorTestId?: string;
}

export function TaskTypeField({ id, testId, value, onChange, errorTestId }: TaskTypeFieldProps) {
  return (
    <TaskFieldRow id={id} label="What needs doing?" wide>
      <TaskTypeSelect id={id} value={value} onChange={onChange} zClassName="z-[650]" className={SELECT_CLASS} data-testid={testId} />
      {!value && errorTestId && (
        <p className="text-xs text-red-600" data-testid={errorTestId}>
          Choose what needs doing.
        </p>
      )}
    </TaskFieldRow>
  );
}

interface TaskCustomTitleFieldProps {
  id: string;
  testId: string;
  taskType: TaskTypeValue | "";
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  /** Optional "Enter what needs doing." message (Add only). */
  error?: { show: boolean; testId: string };
}

/** The free-text title, only shown for the Custom task type. */
export function TaskCustomTitleField({ id, testId, taskType, value, onChange, placeholder, autoFocus, error }: TaskCustomTitleFieldProps) {
  if (taskType !== CUSTOM_TASK_TYPE) return null;
  return (
    <TaskFieldRow id={id} label="Describe the task" wide>
      <Input
        id={id}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={TASK_FIELD_CLASS}
        data-testid={testId}
      />
      {error?.show && !value.trim() && (
        <p className="text-xs text-red-600" data-testid={error.testId}>
          Enter what needs doing.
        </p>
      )}
    </TaskFieldRow>
  );
}

interface SimpleFieldProps<T> {
  id: string;
  testId: string;
  value: T;
  onChange: (value: T) => void;
}

export function TaskAssigneeField({ id, testId, value, onChange }: SimpleFieldProps<string>) {
  return (
    <TaskFieldRow id={id} label="Assign to">
      <UserReassignSelect
        value={value}
        onValueChange={onChange}
        zClassName="z-[650]"
        className="h-11 rounded-[10px] bg-background px-3.5 text-[14px] font-medium"
        data-testid={testId}
      />
    </TaskFieldRow>
  );
}

export function TaskPriorityField({ id, testId, value, onChange }: SimpleFieldProps<TaskPriority>) {
  return (
    <TaskFieldRow id={id} label="Priority">
      <TaskPrioritySelect id={id} value={value} onChange={onChange} zClassName="z-[650]" className={SELECT_CLASS} data-testid={testId} />
    </TaskFieldRow>
  );
}

export function TaskDateField({ id, testId, value, onChange }: SimpleFieldProps<string>) {
  return (
    <TaskFieldRow id={id} label="Date">
      <Input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} className={TASK_FIELD_CLASS} data-testid={testId} />
    </TaskFieldRow>
  );
}

export function TaskTimeField({ id, testId, value, onChange }: SimpleFieldProps<string>) {
  return (
    <TaskFieldRow id={id} label="Time">
      <Input id={id} type="time" value={value} onChange={(e) => onChange(e.target.value)} className={TASK_FIELD_CLASS} data-testid={testId} />
    </TaskFieldRow>
  );
}

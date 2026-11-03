// Public surface of the tasks feature.
// Consumers should import from `@/features/tasks` rather than reaching into
// subpaths. Populated as part of the feature-based structure migration
// (see docs/client-structure-migration-plan.md).
export { taskApi } from "./api/task.api";
export * from "./api/use-task-queries";
export * from "./api/use-task-mutations";
export { TaskTypeSelect } from "./components/shared/task-type-select";
export { TaskPrioritySelect } from "./components/shared/task-priority-select";
export { TaskPriorityPill } from "./components/shared/task-priority-pill";
export { EditTaskDialog, type EditableTask } from "./components/tasks/EditTaskDialog";
export {
  CUSTOM_TASK_TYPE,
  TASK_TYPE_OPTIONS,
  taskTypeForTitle,
  titleForTaskType,
  type TaskTypeValue,
} from "./lib/task-types";
export {
  DEFAULT_TASK_PRIORITY,
  TASK_PRIORITY_OPTIONS,
  TASK_PRIORITY_OPTIONS as TASK_PRIORITIES,
  priorityLabel,
  showPriorityPill,
  type TaskPriority,
} from "./lib/task-priority";

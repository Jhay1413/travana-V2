// Public surface of the tasks feature.
// Consumers should import from `@/features/tasks` rather than reaching into
// subpaths. Populated as part of the feature-based structure migration
// (see docs/client-structure-migration-plan.md).
export { taskApi } from "./api/task.api";
export * from "./api/use-task-queries";
export * from "./api/use-task-mutations";

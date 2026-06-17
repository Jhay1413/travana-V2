// Public surface of the dashboard feature.
// Consumers should import from `@/features/dashboard` rather than reaching into
// subpaths. Populated as part of the feature-based structure migration
// (see docs/client-structure-migration-plan.md).
export * from "./types";
export { dashboardApi } from "./api/dashboard.api";
export * from "./api/use-dashboard-queries";

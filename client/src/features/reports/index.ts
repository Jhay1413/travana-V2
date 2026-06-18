// Public surface of the reports feature.
// Consumers should import from `@/features/reports` rather than reaching into
// subpaths. Populated as part of the feature-based structure migration
// (see docs/client-structure-migration-plan.md).
export * from "./types";
export { reportsApi } from "./api/reports.api";
export { revenueApi } from "./api/revenue.api";
export { targetsApi } from "./api/targets.api";
export * from "./api/use-reports-queries";
export * from "./api/use-revenue-queries";
export * from "./api/use-targets-queries";

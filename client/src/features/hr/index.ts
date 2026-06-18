// Public surface of the hr feature.
// Consumers should import from `@/features/hr` rather than reaching into
// subpaths. Populated as part of the feature-based structure migration
// (see docs/client-structure-migration-plan.md).
export { hrApi } from "./api/hr.api";
export * from "./api/use-hr-queries";
export * from "./api/use-hr-mutations";

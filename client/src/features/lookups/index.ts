// Public surface of the lookups feature.
// Consumers should import from `@/features/lookups` rather than reaching into
// subpaths. Populated as part of the feature-based structure migration
// (see docs/client-structure-migration-plan.md).
export { lookupApi } from "./api/lookup.api";
export * from "./api/use-lookup-queries";

// Public surface of the destination-guru feature.
// Consumers should import from `@/features/destination-guru` rather than reaching into
// subpaths. Populated as part of the feature-based structure migration
// (see docs/client-structure-migration-plan.md).
export { destinationGuruApi } from "./api/destination-guru.api";
export * from "./api/use-destination-guru-queries";
export * from "./api/use-destination-guru-mutations";

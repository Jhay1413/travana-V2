// Public surface of the destination-guru feature.
// Consumers should import from `@/features/destination-guru` rather than reaching into
// subpaths. Populated as part of the feature-based structure migration
// (see docs/client-structure-migration-plan.md).
//
// Deliberately NOT re-exported here: components/globe/** — it pulls in
// three.js, and this barrel is imported by unrelated pages (e.g. quote).
// Import the globe subtree directly from its own path instead.
export { destinationGuruApi } from "./api/destination-guru.api";
export * from "./api/use-destination-guru-queries";
export * from "./api/use-destination-guru-mutations";
export * from "./hooks/use-guru-destinations";
export * from "./hooks/use-globe-view-preference";
export { DestinationGuruSheet } from "./components/destination-guru-sheet";
export { DestinationSearchOverlay } from "./components/destination-search-overlay";
export { NewDestinationDialog } from "./components/new-destination-dialog";
export type { GuruDestinationItem } from "./types";

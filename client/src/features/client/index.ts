// Public surface of the client (customer) feature.
// Consumers should import from `@/features/client` rather than reaching into
// subpaths. Populated as part of the feature-based structure migration
// (see docs/client-structure-migration-plan.md).
export * from "./types";
export * from "./types/neon-client";
export { clientApi } from "./api/client.api";
export { clientFileApi } from "./api/client-file.api";
export { neonClientApi } from "./api/neon-client.api";
export * from "./api/use-client-queries";
export * from "./api/use-neon-client-queries";
export * from "./api/use-client-mutations";
export * from "./api/use-neon-client-mutations";

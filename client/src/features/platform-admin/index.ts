// Public surface of the platform-admin feature.
// Consumers should import from `@/features/platform-admin` rather than reaching into
// subpaths. Populated as part of the feature-based structure migration
// (see docs/client-structure-migration-plan.md).
export { platformAdminApi } from "./api/platform-admin.api";
export * from "./api/use-platform-admin-queries";
export * from "./api/use-platform-admin-mutations";

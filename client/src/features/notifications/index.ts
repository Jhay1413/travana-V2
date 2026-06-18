// Public surface of the notifications feature.
// Consumers should import from `@/features/notifications` rather than reaching into
// subpaths. Populated as part of the feature-based structure migration
// (see docs/client-structure-migration-plan.md).
export * from "./types";
export { notificationApi } from "./api/notification.api";
export * from "./api/use-notification-queries";
export * from "./api/use-notification-mutations";

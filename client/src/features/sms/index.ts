// Public surface of the sms feature.
// Consumers should import from `@/features/sms` rather than reaching into
// subpaths. Populated as part of the feature-based structure migration
// (see docs/client-structure-migration-plan.md).
export { smsApi } from "./api/sms.api";
export * from "./api/use-sms-queries";
export * from "./api/use-sms-mutations";

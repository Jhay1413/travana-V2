// Public surface of the transaction feature.
// Consumers should import from `@/features/transaction` rather than reaching
// into subpaths. Populated as part of the feature-based structure migration
// (see docs/client-structure-migration-plan.md).
export { transactionApi } from "./api/transaction.api";
export * from "./api/use-transaction-queries";
export * from "./api/use-transaction-mutations";

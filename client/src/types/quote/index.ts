// Re-export shim — quote types moved to features/quote/types as part of the
// feature-based structure migration (see docs/client-structure-migration-plan.md).
// Existing `@/types/quote` importers keep working; convert them to
// `@/features/quote` and delete this shim in the consumer-codemod phase.
export * from "@/features/quote/types";

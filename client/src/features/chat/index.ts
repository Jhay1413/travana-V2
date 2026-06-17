// Public surface of the chat feature.
// Consumers should import from `@/features/chat` rather than reaching into
// subpaths. Populated as part of the feature-based structure migration
// (see docs/client-structure-migration-plan.md).
export { chatApi } from "./api/chat.api";
export * from "./api/use-chat-queries";
export * from "./api/use-chat-mutations";

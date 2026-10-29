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
export * from "./api/use-client-search";
export { CreateTicketDialog } from "./components/modals/CreateTicketDialog";
export { useClientTaskCreate, useClientTicketCreate } from "./components/hooks";
export { isLostBooking } from "./lib/client-stats";
export { ClientFormDrawer } from "./components/modals/ClientFormDrawer";
export { useClientCreateForm } from "./components/hooks";
export { isClientReadOnly } from "./lib/client-access";
export { liveDealOptions, taskEntityForDeal, linkedTaskEntity, dealKey, DEAL_GROUP_LABELS, DEAL_GROUP_ORDER, type TaskDealOption, type TaskDealType } from "./lib/task-link";

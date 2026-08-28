// Public surface of the tickets feature.
// Consumers should import from `@/features/tickets` rather than reaching into
// subpaths. Populated as part of the feature-based structure migration
// (see docs/client-structure-migration-plan.md).
export * from "./types";
export * from "./lib/ticket-filters";
export { ticketApi } from "./api/ticket.api";
export * from "./api/use-ticket-queries";
export * from "./api/use-ticket-mutations";
export { TicketsInbox } from "./components/tickets-inbox";
export { CreateTicketDialog } from "./components/create-ticket-dialog";

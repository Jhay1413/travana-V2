// Public surface of the tickets feature.
// Consumers should import from `@/features/tickets` rather than reaching into
// subpaths. Populated as part of the feature-based structure migration
// (see docs/client-structure-migration-plan.md).
export * from "./types";
export * from "./lib/ticket-filters";
export * from "./lib/author-colors";
export * from "./lib/sort-pinned-first";
export { ticketApi } from "./api/ticket.api";
export * from "./api/use-ticket-queries";
export * from "./api/use-ticket-mutations";
export * from "./api/use-ticket-pin";
export { TicketsQueue } from "./components/queue/tickets-queue";
export { TicketPage } from "./components/page/ticket-page";
export { CreateTicketDialog } from "./components/dialogs/new-ticket/create-ticket-dialog";
export { ReplyThreadToggle } from "./components/reply-thread-toggle";
export { TicketAttachmentList } from "./components/ticket-attachment-list";

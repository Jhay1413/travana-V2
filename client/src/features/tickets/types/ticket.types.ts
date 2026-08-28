// The tickets feature's fixed value sets — used by the create dialog and the
// thread panel's status menu alike, so they live here rather than in either
// component.
export const TICKET_TYPES = ["Admin", "Build", "Sales"] as const;
export const TICKET_STATUSES = ["Open", "In Progress", "Resolved", "Closed"] as const;
export const TICKET_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

export type TicketTypeValue = (typeof TICKET_TYPES)[number];
export type TicketStatusValue = (typeof TICKET_STATUSES)[number];
export type TicketPriorityValue = (typeof TICKET_PRIORITIES)[number];

export interface Ticket {
  id: string;
  clientId: string;
  userId: string;
  assignedTo: string | null;
  bookingId?: string | null;
  type: string;
  status: string;
  priority: string;
  subject: string;
  description: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string | null;
  resolvedAt: string | null;
  clientName?: string | null;
  userName?: string | null;
  assignedToName?: string | null;
  replyCount?: number;
}

export type CreateTicketData = Omit<Ticket, "id" | "createdAt" | "updatedAt" | "resolvedAt" | "dueDate" | "assignedTo" | "clientId"> & {
  // Build (internal) tickets have no client.
  clientId: string | null;
  dueDate?: string | null;
  assignedTo?: string | null;
};

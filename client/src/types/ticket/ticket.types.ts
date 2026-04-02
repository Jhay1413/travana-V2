export interface Ticket {
  id: string;
  clientId: string;
  userId: string;
  assignedTo: string | null;
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

export type CreateTicketData = Omit<Ticket, "id" | "createdAt" | "updatedAt" | "resolvedAt">;

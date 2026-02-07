export interface Ticket {
  id: string;
  clientId: string;
  userId: string;
  type: string;
  status: string;
  priority: string;
  subject: string;
  description: string | null;
  createdAt: string;
  updatedAt: string | null;
  resolvedAt: string | null;
  clientName?: string | null;
  userName?: string | null;
}

export type CreateTicketData = Omit<Ticket, "id" | "createdAt" | "updatedAt" | "resolvedAt">;

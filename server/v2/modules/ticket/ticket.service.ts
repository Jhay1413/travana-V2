import { ticketRepository, type TicketListMode } from "./ticket.repository";
import { realtimeService } from "../../realtime/realtime.service";
import { AppError } from "../../utils/error-handler";
import { sanitizeRichText } from "../../utils/sanitize-rich-text";
import type { Ticket, InsertTicket } from "@shared/schema";
import { hasAnyRole, type OrgRole, type Scope } from "../../utils/scope";

// Roles allowed to request the unfiltered ("all") ticket list — everyone else
// is confined to "mine"/"raised", enforced here rather than trusting the
// client, since the query param is caller-controlled.
const ADMIN_TICKET_ROLES: OrgRole[] = ["org_admin", "branch_manager", "platform_admin"];

// Fields a PATCH must never move: which org/branch a ticket belongs to, or
// who raised it, are not editable via the ticket update form — stripped here
// (not just relied on the client to omit them) so a crafted request can't use
// this endpoint to move a ticket cross-tenant or rewrite its creator.
type EditableTicketFields = Omit<Partial<InsertTicket>, "orgId" | "branchId" | "userId">;

function stripImmutableFields(data: Partial<InsertTicket>): EditableTicketFields {
  const { orgId: _orgId, branchId: _branchId, userId: _userId, ...editable } = data;
  return editable;
}

// Fans a ticket write out to every agent in the org over SSE, so the sidebar's
// open-ticket badge and any open ticket list move without a reload — a ticket
// raised or reassigned by one agent shows up on the assignee's screen.
//
// Best-effort, exactly like the conversations publisher: a bus failure must
// never fail the write the user is waiting on.
function publishChanged(orgId: string, ticketId: string): void {
  if (!orgId || !ticketId) return;
  try {
    realtimeService.publish(orgId, { type: "ticket.changed", ticketId });
  } catch (err) {
    console.warn(`[tickets] realtime publish failed for ticket ${ticketId}:`, err);
  }
}

export const ticketService = {
  async listTickets(scope: Scope, mode: TicketListMode = "mine") {
    if (mode === "all" && !hasAnyRole(scope.orgRoles, ADMIN_TICKET_ROLES)) {
      throw new AppError("You do not have permission to view all tickets", 403);
    }
    return await ticketRepository.findAll(scope, scope.userId ?? null, mode);
  },

  async listTicketsByClient(clientId: string, scope: Scope) {
    return await ticketRepository.findByClientId(clientId, scope, scope.userId ?? null);
  },

  async listTicketsByUser(
    userId: string,
    scope: Scope,
    filters?: { statuses?: string[]; assignedOnly?: boolean },
  ) {
    return await ticketRepository.findByAssignedTo(userId, scope, filters, scope.userId ?? null);
  },

  async getTicketById(id: string, scope?: Scope) {
    const ticket = await ticketRepository.findById(id, scope, scope?.userId ?? null);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }
    return ticket;
  },

  async createTicket(data: InsertTicket, scope: Scope): Promise<Ticket> {
    const values = data.description ? { ...data, description: sanitizeRichText(data.description) } : data;
    const ticket = await ticketRepository.create(values, scope);
    publishChanged(scope.orgId, ticket.id);
    return ticket;
  },

  async updateTicket(id: string, data: Partial<InsertTicket>, scope: Scope): Promise<Ticket> {
    const editable = stripImmutableFields(data);
    const values = editable.description ? { ...editable, description: sanitizeRichText(editable.description) } : editable;
    const ticket = await ticketRepository.update(id, values, scope);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }
    // Covers the badge's two inputs — status (open → resolved) and assignment —
    // without this layer needing to know which fields `data` touched.
    publishChanged(scope.orgId, ticket.id);
    return ticket;
  },

  async deleteTicket(id: string, scope: Scope): Promise<void> {
    const removed = await ticketRepository.remove(id, scope);
    if (!removed) {
      throw new AppError("Ticket not found", 404);
    }
    publishChanged(scope.orgId, id);
  },

  async toggleLike(id: string, userId: string, scope: Scope): Promise<{ liked: boolean; likeCount: number }> {
    const ticket = await ticketRepository.findById(id, scope);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }
    return ticketRepository.toggleLike(id, userId);
  },
};

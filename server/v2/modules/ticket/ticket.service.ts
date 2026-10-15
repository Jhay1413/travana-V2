import { ticketRepository, type TicketListMode } from "./ticket.repository";
import { realtimeService } from "../../realtime/realtime.service";
import { notificationRepository } from "../notification/notification.repository";
import { branchMemberRepository } from "../branch-member/branch-member.repository";
import { branchRepository } from "../branch/branch.repository";
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

/**
 * Fires the "you were assigned a ticket" notification. Best-effort: a
 * failure here must never fail the create/update the caller is waiting on.
 * Assigning a ticket to yourself never notifies (no enquiry/quote-style
 * exception applies to tickets).
 */
async function notifyTicketAssignee(ticket: Ticket, actingUserId: string | null | undefined): Promise<void> {
  if (!ticket.assignedTo) return;
  if (actingUserId && ticket.assignedTo === actingUserId) return;

  try {
    await notificationRepository.create({
      userId: ticket.assignedTo,
      type: "ticket_assigned",
      title: "Ticket assigned to you",
      message: `You were assigned to "${ticket.subject}"`,
      link: `/tickets/${ticket.id}`,
      read: false,
    });
  } catch (err) {
    console.warn(`[tickets] assignment notification failed for ticket ${ticket.id}:`, err);
  }
}

// Shop and homeworker data are isolated from each other, so a ticket must not be
// assigned across that boundary by ordinary staff: the assignee could never open
// it (or the reverse). The assignee's side comes from their active branch membership.
//
// org_admin / platform_admin oversee both sides, so they may assign across it; the
// ticket is then re-homed into the assignee's branch (returned here) so the
// assignee can open it. Returns the branch_id to write, or undefined for no change.
async function resolveAssignmentBranch(
  assigneeId: string | null | undefined,
  scope: Scope,
  currentBranchId: string | null | undefined,
): Promise<string | undefined> {
  if (!assigneeId || assigneeId === scope.userId) return undefined;
  // The assignee must be an active member of the caller's org. A platform_admin who
  // is not impersonating has scope.orgId === '' (no org), so they are not org-filtered.
  const assignee = scope.orgId
    ? await branchMemberRepository.findActiveContextByUserIdInOrg(assigneeId, scope.orgId)
    : await branchMemberRepository.findActiveContextByUserId(assigneeId);
  if (!assignee && scope.orgId) {
    throw new AppError("Assignee is not an active member of this organisation", 400);
  }
  const assigneeIsHomeworkerSide = assignee?.branchType === "homeworker";

  if (scope.orgRole !== "org_admin" && scope.orgRole !== "platform_admin") {
    const callerIsHomeworkerSide = scope.branchType === "homeworker";
    if (callerIsHomeworkerSide !== assigneeIsHomeworkerSide) {
      throw new AppError("Tickets cannot be assigned across shop and homeworker branches", 400);
    }
    return undefined;
  }

  if (!assignee) return undefined;
  if (assigneeIsHomeworkerSide) {
    return assignee.branchId !== currentBranchId ? assignee.branchId : undefined;
  }
  // Shop assignee: only a ticket currently in a homeworker branch needs moving back.
  if (currentBranchId && currentBranchId !== assignee.branchId) {
    // Use the assignee's org (not scope.orgId, which is '' for a non-impersonating
    // platform_admin) so the shop re-home also works for them.
    const current = await branchRepository.findById(currentBranchId, assignee.orgId);
    if (current?.branchType === "homeworker") return assignee.branchId;
  }
  return undefined;
}

function isAdminScope(scope: Scope): boolean {
  return scope.orgRole === "org_admin" || scope.orgRole === "platform_admin";
}

// Admins may pick a branch for a new ticket, but only one inside their own org.
// A platform_admin with no org context cannot be validated, so the value is dropped.
async function resolveRequestedBranch(branchId: string | null | undefined, scope: Scope): Promise<string | undefined> {
  if (!branchId || !isAdminScope(scope) || !scope.orgId) return undefined;
  const found = await branchRepository.findById(branchId, scope.orgId);
  if (!found) throw new AppError("Branch not found in this organisation", 400);
  return found.id;
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
    // orgId always comes from the caller's scope, never the request body; branchId
    // only from an admin, validated to be inside their org.
    const { orgId: _ignoredOrgId, branchId: requestedBranchId, ...body } = data;
    const requestedBranch = await resolveRequestedBranch(requestedBranchId, scope);
    const rehomeTo = await resolveAssignmentBranch(body.assignedTo, scope, requestedBranch ?? scope.branchId);
    const chosenBranch = rehomeTo ?? requestedBranch;
    const base = body.description ? { ...body, description: sanitizeRichText(body.description) } : body;
    const values: InsertTicket = chosenBranch ? { ...base, branchId: chosenBranch } : base;
    const ticket = await ticketRepository.create(values, scope);
    publishChanged(scope.orgId, ticket.id);
    await notifyTicketAssignee(ticket, scope.userId);
    return ticket;
  },

  async updateTicket(id: string, data: Partial<InsertTicket>, scope: Scope): Promise<Ticket> {
    const editable = stripImmutableFields(data);
    const values = editable.description ? { ...editable, description: sanitizeRichText(editable.description) } : editable;

    // Only needed when this update actually touches assignment — read before
    // the write so a reassignment can be told apart from a resave that
    // merely echoes the current assignee back.
    const previous = editable.assignedTo !== undefined ? await ticketRepository.findById(id, scope, scope.userId ?? null) : undefined;

    const rehomeTo = await resolveAssignmentBranch(editable.assignedTo, scope, previous?.branchId);
    const ticket = await ticketRepository.update(id, rehomeTo ? { ...values, branchId: rehomeTo } : values, scope);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }
    // Covers the badge's two inputs — status (open → resolved) and assignment —
    // without this layer needing to know which fields `data` touched.
    publishChanged(scope.orgId, ticket.id);

    if (editable.assignedTo !== undefined && ticket.assignedTo !== previous?.assignedTo) {
      await notifyTicketAssignee(ticket, scope.userId);
    }

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

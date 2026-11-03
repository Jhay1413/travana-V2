import { ticketRepository, type TicketListMode } from "./ticket.repository";
import { realtimeService } from "../../realtime/realtime.service";
import { notificationRepository } from "../notification/notification.repository";
import { branchMemberRepository } from "../branch-member/branch-member.repository";
import { branchRepository } from "../branch/branch.repository";
import { transactionRepository } from "../transaction/transaction.repository";
import { AppError } from "../../utils/error-handler";
import { sanitizeRichText } from "../../utils/sanitize-rich-text";
import type { Ticket, InsertTicket } from "@shared/schema";
import { hasAnyRole, type OrgRole, type Scope } from "../../utils/scope";
import type {
  HolidayQuoteRow,
  HolidayTransactionRow,
  TicketHolidayKind,
  TicketHolidaySummary,
  TicketListItem,
  TicketWriteValues,
} from "./ticket.types";

// Roles allowed to request the unfiltered ("all") ticket list — everyone else
// is confined to "mine"/"raised", enforced here rather than trusting the
// client, since the query param is caller-controlled.
const ADMIN_TICKET_ROLES: OrgRole[] = ["org_admin", "branch_manager", "platform_admin"];

// Fields a PATCH must never move: which org/branch a ticket belongs to, or
// who raised it, are not editable via the ticket update form — stripped here
// (not just relied on the client to omit them) so a crafted request can't use
// this endpoint to move a ticket cross-tenant or rewrite its creator.
type EditableTicketFields = Omit<Partial<InsertTicket>, "orgId" | "branchId" | "userId">;

// id / createdAt / updatedAt / resolvedAt are server-owned too. The validator
// already omits them from the schema, but the service must not rely on that:
// resolvedAt in particular is derived from status by resolvedAtFor below.
function stripImmutableFields(data: Partial<InsertTicket>): EditableTicketFields {
  const { orgId: _orgId, branchId: _branchId, userId: _userId, ...rest } = data;
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    resolvedAt: _resolvedAt,
    ...editable
  } = rest as typeof rest & { id?: unknown; createdAt?: unknown; updatedAt?: unknown; resolvedAt?: unknown };
  return editable;
}

const CLOSED_STATUSES = ["Resolved", "Closed"];

/**
 * What resolvedAt should become when a ticket's status is written.
 *  - Resolved / Closed: stamp now, unless it was already Resolved/Closed with a
 *    stamp (undefined = leave the column alone, so closing a resolved ticket
 *    doesn't move the date).
 *  - Open / In Progress: clear it (null).
 *  - status not being changed / unknown: undefined (no write).
 */
export function resolvedAtFor(
  nextStatus: string | undefined,
  previous: { status: string; resolvedAt: Date | null } | undefined,
  now: Date,
): Date | null | undefined {
  if (nextStatus === undefined) return undefined;
  if (CLOSED_STATUSES.includes(nextStatus)) {
    if (previous && CLOSED_STATUSES.includes(previous.status) && previous.resolvedAt) return undefined;
    return now;
  }
  if (nextStatus === "Open" || nextStatus === "In Progress") return null;
  return undefined;
}

const BOOKING_STAGE: Record<string, TicketHolidayKind> = {
  on_booking: "booking",
  on_quote: "quote",
  on_enquiry: "enquiry",
};

/**
 * Builds the holiday summary shown on a ticket row from the raw transaction
 * facts. Null when the transaction belongs to a different org than the ticket
 * (never leak another tenant's holiday through a stale link).
 */
export function buildHolidaySummary(
  txn: HolidayTransactionRow,
  quoteRow: HolidayQuoteRow | undefined,
  ticketOrgId: string | null,
): TicketHolidaySummary | null {
  if (txn.orgId !== ticketOrgId) return null;

  const has: Record<TicketHolidayKind, boolean> = {
    booking: txn.bookingId !== null,
    quote: !!quoteRow,
    enquiry: txn.enquiryId !== null,
  };
  const staged = txn.status ? BOOKING_STAGE[txn.status] : undefined;
  const kind: TicketHolidayKind | null =
    staged && has[staged]
      ? staged
      : has.booking
        ? "booking"
        : has.quote
          ? "quote"
          : has.enquiry
            ? "enquiry"
            : null;

  const base: TicketHolidaySummary = {
    transactionId: txn.transactionId,
    kind,
    title: null,
    travelDate: null,
    nights: null,
    operatorName: null,
    operatorLogoUrl: null,
    haysRef: null,
    supplierRef: null,
  };
  const nightsOrNull = (n: number | null): number | null => (n && n > 0 ? n : null);

  if (kind === "booking") {
    return {
      ...base,
      title: txn.bookingTitle,
      travelDate: txn.bookingTravelDate,
      nights: nightsOrNull(txn.bookingNights),
      operatorName: txn.bookingOperatorName,
      operatorLogoUrl: txn.bookingOperatorLogoUrl,
      haysRef: txn.haysRef,
      supplierRef: txn.supplierRef,
    };
  }
  if (kind === "quote" && quoteRow) {
    return {
      ...base,
      title: quoteRow.title,
      travelDate: quoteRow.travelDate,
      nights: nightsOrNull(quoteRow.nights),
      operatorName: quoteRow.operatorName,
      operatorLogoUrl: quoteRow.operatorLogoUrl,
    };
  }
  if (kind === "enquiry") {
    return {
      ...base,
      title: txn.enquiryTitle,
      travelDate: txn.enquiryTravelDate,
      nights: nightsOrNull(txn.enquiryNights),
    };
  }
  return base;
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

// A ticket may only link to a holiday of its own org and its own client. The
// ticket's org is the caller's org on create and the stored org on update;
// a null ticketOrgId (platform_admin acting without an org) skips only the org
// comparison - the client check always applies, so a Build ticket with no client
// can never be linked to a holiday.
async function assertHolidayLink(
  transactionId: string,
  ticketOrgId: string | null,
  ticketClientId: string | null | undefined,
  scope: Scope,
): Promise<void> {
  const target = await ticketRepository.findHolidayLinkTarget(transactionId);
  if (!target || (ticketOrgId && target.orgId !== ticketOrgId)) {
    throw new AppError("Holiday not found", 400);
  }
  // The caller must also be allowed to see that holiday under the transaction
  // module pipeline rules (buildTxnScopeConds: org, agent/branch_manager branch pinning, partition), so
  // a link cannot be used to reach a deal they could not open themselves.
  const visible = await transactionRepository.findByIdScopedForWrite(transactionId, scope);
  if (!visible) throw new AppError("Holiday not found", 400);
  if (!ticketClientId || target.clientId !== ticketClientId) {
    throw new AppError("Holiday belongs to a different client", 400);
  }
}

// A ticket may only be filed against a client of its own org. A null
// ticketOrgId (trusted / org-less platform_admin) skips only the comparison.
async function assertClientInOrg(clientId: string, ticketOrgId: string | null): Promise<void> {
  const client = await ticketRepository.findClientRef(clientId);
  if (!client || (ticketOrgId && client.orgId !== ticketOrgId)) {
    throw new AppError("Client not found", 400);
  }
}

export const ticketService = {
  async listTickets(scope: Scope, mode: TicketListMode = "mine"): Promise<TicketListItem[]> {
    if (mode === "all" && !hasAnyRole(scope.orgRoles, ADMIN_TICKET_ROLES)) {
      throw new AppError("You do not have permission to view all tickets", 403);
    }
    const rows = await ticketRepository.findAll(scope, scope.userId ?? null, mode);

    const transactionIds = Array.from(new Set(rows.map((r) => r.transactionId).filter((id): id is string => !!id)));
    if (transactionIds.length === 0) return rows.map((r) => ({ ...r, holiday: null }));

    const { transactions, quotes } = await ticketRepository.findHolidaySummaries(transactionIds);
    const txnById = new Map(transactions.map((t) => [t.transactionId, t]));
    const quoteByTxn = new Map(quotes.map((q) => [q.transactionId, q]));
    return rows.map((r) => {
      const txn = r.transactionId ? txnById.get(r.transactionId) : undefined;
      return {
        ...r,
        holiday: txn ? buildHolidaySummary(txn, quoteByTxn.get(txn.transactionId), r.orgId ?? null) : null,
      };
    });
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
    // validate() does not replace req.body, so strip every server-owned field
    // here and never trust a body userId when the caller is a real user.
    const {
      orgId: _ignoredOrgId,
      branchId: requestedBranchId,
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      resolvedAt: _resolvedAt,
      ...rest
    } = data as InsertTicket & { id?: unknown; createdAt?: unknown; updatedAt?: unknown; resolvedAt?: unknown };
    const body: InsertTicket = { ...rest, userId: scope.userId ?? rest.userId };
    if (body.clientId) {
      await assertClientInOrg(body.clientId, scope.orgId || null);
    }
    if (body.transactionId) {
      await assertHolidayLink(body.transactionId, scope.orgId || null, body.clientId, scope);
    }
    const requestedBranch = await resolveRequestedBranch(requestedBranchId, scope);
    const rehomeTo = await resolveAssignmentBranch(body.assignedTo, scope, requestedBranch ?? scope.branchId);
    const chosenBranch = rehomeTo ?? requestedBranch;
    const base = body.description ? { ...body, description: sanitizeRichText(body.description) } : body;
    const withBranch: InsertTicket = chosenBranch ? { ...base, branchId: chosenBranch } : base;
    const resolvedAt = resolvedAtFor(withBranch.status, undefined, new Date());
    const values = resolvedAt ? { ...withBranch, resolvedAt } : withBranch;
    const ticket = await ticketRepository.create(values, scope);
    publishChanged(scope.orgId, ticket.id);
    await notifyTicketAssignee(ticket, scope.userId);
    return ticket;
  },

  async updateTicket(id: string, data: Partial<InsertTicket>, scope: Scope): Promise<Ticket> {
    const editable = stripImmutableFields(data);
    const sanitizedBase = editable.description ? { ...editable, description: sanitizeRichText(editable.description) } : editable;

    // Only needed when this update touches assignment, status or the holiday
    // link - read before the write so a reassignment can be told apart from a
    // resave that merely echoes the current assignee back, a status change can
    // stamp/clear resolvedAt, and a link can be checked against the ticket.
    const needsPrevious =
      editable.assignedTo !== undefined ||
      editable.status !== undefined ||
      editable.clientId !== undefined ||
      !!editable.transactionId;
    const previous = needsPrevious ? await ticketRepository.findById(id, scope, scope.userId ?? null) : undefined;

    if (editable.clientId || editable.transactionId) {
      if (!previous) throw new AppError("Ticket not found", 404);
    }
    if (editable.clientId && previous) {
      await assertClientInOrg(editable.clientId, previous.orgId ?? null);
    }
    const clientChanged = !!previous && editable.clientId !== undefined && editable.clientId !== previous.clientId;
    if (editable.transactionId && previous) {
      const unchanged = editable.transactionId === previous.transactionId && !clientChanged;
      if (!unchanged) {
        const resultingClientId = editable.clientId !== undefined ? editable.clientId : previous.clientId;
        await assertHolidayLink(editable.transactionId, previous.orgId ?? null, resultingClientId, scope);
      }
    }
    // Moving the ticket to another client (or none) orphans its holiday link.
    const orphaned = clientChanged && editable.transactionId === undefined && !!previous?.transactionId;

    const sanitized = orphaned ? { ...sanitizedBase, transactionId: null } : sanitizedBase;
    const resolvedAt = resolvedAtFor(editable.status, previous, new Date());
    const values: TicketWriteValues = resolvedAt === undefined ? sanitized : { ...sanitized, resolvedAt };

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

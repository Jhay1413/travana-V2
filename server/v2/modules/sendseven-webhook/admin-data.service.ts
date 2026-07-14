import { ticketService } from "../ticket/ticket.service";
import { ticketAttachmentService } from "../ticket/ticket-attachment.service";
import { clientFileService } from "../client/client-file.service";
import { internalChatClientsRepository } from "../internal-chat/internal-chat-clients.repository";
import { branchMemberRepository } from "../branch-member/branch-member.repository";
import { systemScope } from "./identity.service";
import type { InsertTicket } from "@shared/schema";

// Valid ticket field values (mirror the staff CreateTicketDialog — the `type`
// column is free-text with no DB enum, so we constrain to the same set the UI
// offers). A bot-created ticket defaults to an "Admin" request, Open + Medium.
const TICKET_TYPES = ["Admin", "Build", "Sales"] as const;
const TICKET_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

// A conversation attachment already downloaded from SendSeven, ready to attach
// to a ticket. Kept in memory (files are ≤10MB) — never written to client files.
export interface PendingAttachment {
  buffer: Buffer;
  filename: string;
  contentType: string;
  size: number;
}

// Uploads an attachment's bytes to S3 and records the ticket_attachment row via
// the shared ticket-attachment service (same path the staff upload uses). Best-effort.
async function attachFileToTicket(ticketId: string, orgId: string, att: PendingAttachment): Promise<boolean> {
  try {
    await ticketAttachmentService.uploadAndCreate(
      ticketId,
      { buffer: att.buffer, originalName: att.filename, mimeType: att.contentType, size: att.size },
      systemScope(orgId),
    );
    return true;
  } catch (err) {
    console.error(`[admin-data] attachFileToTicket failed for ticket ${ticketId}:`, err);
    return false;
  }
}

// Client-scoped, CUSTOMER-SAFE data access for the admin bot
// (admin-agent.service.ts). Every method is keyed on a SERVER-SUPPLIED
// (orgId, clientId) — never anything the model supplies — and returns a
// projected shape with no internal/financial/agency-only fields. All methods
// are resilient: any thrown error is logged and swallowed, degrading to an
// empty list / null rather than letting a DB error (or its message) reach the
// model/customer.

export interface CustomerSafeTicket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface CustomerSafeFile {
  id: string;
  title: string | null;
  category: string | null;
  originalName: string;
  createdAt: Date;
}

export interface CustomerSafeQuote {
  quoteRef: string | null;
  status: string | null;
  destination: string | null;
  resort: string | null;
  country: string | null;
  boardBasis: string | null;
  travelDate: string;
  nights: number | null;
  partySize: { adults: number | null; children: number | null; infants: number | null };
  salesPrice: string | null;
  pricePerPerson: string;
}

export interface CustomerSafeEnquiry {
  title: string | null;
  status: string | null;
  holidayType: string | null;
  destinations: string[];
  travelDate: string | null;
  partySize: { adults: number | null; children: number | null; infants: number | null };
  budget: string | null;
  createdAt: Date | null;
}

export const adminDataService = {
  async getTickets(orgId: string, clientId: string): Promise<CustomerSafeTicket[]> {
    try {
      const tickets = await ticketService.listTicketsByClient(clientId, systemScope(orgId));
      return tickets.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt ?? null,
      }));
    } catch (err) {
      console.error(`[admin-data] getTickets failed for client ${clientId}:`, err);
      return [];
    }
  },

  async getFiles(clientId: string): Promise<CustomerSafeFile[]> {
    try {
      const files = await clientFileService.listByClientId(clientId);
      return files.map((f) => ({
        id: f.id,
        title: f.title ?? null,
        category: f.category ?? null,
        originalName: f.originalName,
        createdAt: f.createdAt,
      }));
    } catch (err) {
      console.error(`[admin-data] getFiles failed for client ${clientId}:`, err);
      return [];
    }
  },

  // Verifies fileId belongs to THIS client BEFORE resolving a download target —
  // clientFileService.getDownloadTarget looks up by id alone with no ownership
  // check, so we never trust a fileId the model supplies without confirming it
  // first appeared in this client's own file list.
  async getFileLink(clientId: string, fileId: string): Promise<string | null> {
    try {
      const files = await clientFileService.listByClientId(clientId);
      const owned = files.some((f) => f.id === fileId);
      if (!owned) return null;

      const target = await clientFileService.getDownloadTarget(fileId, { inline: true });
      return target.kind === "s3" ? target.url : null;
    } catch (err) {
      console.error(`[admin-data] getFileLink failed for client ${clientId} file ${fileId}:`, err);
      return null;
    }
  },

  async getQuotes(orgId: string, clientId: string): Promise<CustomerSafeQuote[]> {
    try {
      const { rows } = await internalChatClientsRepository.getClientQuoteDetails(clientId, orgId);
      return rows.map((r) => ({
        quoteRef: r.quoteRef,
        status: r.quoteStatus,
        destination: r.destinationName,
        resort: r.resortName,
        country: r.countryName,
        boardBasis: r.boardBasisName,
        travelDate: r.travelDate,
        nights: r.numOfNights,
        partySize: { adults: r.adult, children: r.child, infants: r.infant },
        salesPrice: r.salesPrice,
        pricePerPerson: r.pricePerPerson,
      }));
    } catch (err) {
      console.error(`[admin-data] getQuotes failed for client ${clientId}:`, err);
      return [];
    }
  },

  async getEnquiries(orgId: string, clientId: string): Promise<CustomerSafeEnquiry[]> {
    try {
      const { rows } = await internalChatClientsRepository.getClientEnquiryDetails(clientId, orgId);
      return rows.map((r) => ({
        title: r.title,
        status: r.status,
        holidayType: r.holidayTypeName,
        destinations: r.destinations,
        travelDate: r.travelDate,
        partySize: { adults: r.adults, children: r.children, infants: r.infants },
        budget: r.budget,
        createdAt: r.dateCreated,
      }));
    } catch (err) {
      console.error(`[admin-data] getEnquiries failed for client ${clientId}:`, err);
      return [];
    }
  },

  // Opens a support ticket for THIS (server-supplied) client. Like the read
  // methods, clientId comes from the resolved conversation — never the model —
  // so a ticket is always filed against the connected client. The owner
  // (tickets.user_id is NOT NULL) is a default org member, same as bot-created
  // enquiries. type/priority are constrained to the app's own value sets;
  // anything else falls back to the safe defaults. Returns the new ticket's
  // id/subject/status, or null on failure (the agent then degrades gracefully).
  async createTicket(
    orgId: string,
    clientId: string,
    input: {
      subject: string;
      description?: string;
      type?: string;
      priority?: string;
      // Files the customer sent this turn — attached to the NEW ticket (on local
      // disk, like the staff upload). They are deliberately NOT added to the
      // client's files; a staff member can move them there from the ticket.
      attachments?: PendingAttachment[];
    },
  ): Promise<{ id: string; subject: string; status: string; attachedCount: number } | null> {
    try {
      const subject = input.subject?.trim();
      if (!subject) return null;

      const ownerId = await branchMemberRepository.findDefaultOwner(orgId);
      if (!ownerId) {
        console.warn(`[admin-data] createTicket: org ${orgId} has no user to own the ticket — skipping`);
        return null;
      }

      const type = (TICKET_TYPES as readonly string[]).includes(input.type ?? "") ? (input.type as string) : "Admin";
      const priority = (TICKET_PRIORITIES as readonly string[]).includes(input.priority ?? "")
        ? (input.priority as string)
        : "Medium";

      const ticket = await ticketService.createTicket(
        {
          clientId,
          userId: ownerId,
          type,
          status: "Open",
          priority,
          subject: subject.slice(0, 200),
          description: input.description?.trim() || null,
        } as InsertTicket,
        systemScope(orgId),
      );

      let attachedCount = 0;
      for (const att of input.attachments ?? []) {
        if (await attachFileToTicket(ticket.id, orgId, att)) attachedCount += 1;
      }

      return { id: ticket.id, subject: ticket.subject, status: ticket.status, attachedCount };
    } catch (err) {
      console.error(`[admin-data] createTicket failed for client ${clientId}:`, err);
      return null;
    }
  },
};

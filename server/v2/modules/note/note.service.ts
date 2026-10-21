import { noteRepository, type NoteWithAuthor } from "./note.repository";
import { AppError } from "../../utils/error-handler";
import type { Note, InsertNote } from "@shared/schema";
import type { Scope } from "../../utils/scope";
import { sanitizeRichText } from "../../utils/sanitize-rich-text";

type ScopeOrTrusted = Scope | { orgId: null };

function effectiveOrgId(scope: ScopeOrTrusted): string | null {
  if (scope.orgId === null) return null;
  if ((scope as Scope).orgRole === "platform_admin") return null;
  return (scope as Scope).orgId || null;
}

async function assertTransactionInScope(transactionId: string, scope: ScopeOrTrusted) {
  const orgId = effectiveOrgId(scope);
  if (!orgId) return;
  const ok = await noteRepository.transactionBelongsToOrg(transactionId, orgId, scope);
  if (!ok) throw new AppError("Notes not found", 404);
}

async function assertClientInScope(clientId: string, scope: ScopeOrTrusted) {
  const orgId = effectiveOrgId(scope);
  if (!orgId) return;
  const ok = await noteRepository.clientBelongsToOrg(clientId, orgId, scope);
  if (!ok) throw new AppError("Notes not found", 404);
}

async function loadScopedNote(id: string, scope: ScopeOrTrusted): Promise<Note> {
  const orgId = effectiveOrgId(scope);
  if (!orgId) {
    const n = await noteRepository.findById(id);
    if (!n) throw new AppError("Note not found", 404);
    return n;
  }
  const row = await noteRepository.findByIdWithOrg(id);
  if (!row || row.orgId !== orgId) {
    throw new AppError("Note not found", 404);
  }
  // Notes carry no branch of their own: they inherit the partition of the deal
  // or client they belong to.
  if (row.transaction_id) {
    if (!(await noteRepository.transactionBelongsToOrg(row.transaction_id, orgId, scope))) {
      throw new AppError("Note not found", 404);
    }
  } else if (row.client_id) {
    if (!(await noteRepository.clientBelongsToOrg(row.client_id, orgId, scope))) {
      throw new AppError("Note not found", 404);
    }
  }
  const n = await noteRepository.findById(id);
  if (!n) throw new AppError("Note not found", 404);
  return n;
}

// Rows written before write-side sanitising existed may hold unsafe HTML, so
// content is also cleaned on the way out. sanitizeRichText is idempotent.
function cleanContent<T extends { content: string | null }>(note: T): T {
  return typeof note.content === "string" ? { ...note, content: sanitizeRichText(note.content) } : note;
}

export const noteService = {
  async listByTransactionId(transactionId: string, scope: ScopeOrTrusted): Promise<NoteWithAuthor[]> {
    await assertTransactionInScope(transactionId, scope);
    return (await noteRepository.findByTransactionId(transactionId)).map(cleanContent);
  },

  async listByClientId(
    clientId: string,
    scope: ScopeOrTrusted,
    options?: { includeDeals?: boolean },
  ): Promise<NoteWithAuthor[]> {
    await assertClientInScope(clientId, scope);
    return (await noteRepository.findByClientId(clientId, scope, options)).map(cleanContent);
  },

  async getNote(id: string, scope: ScopeOrTrusted): Promise<Note> {
    return cleanContent(await loadScopedNote(id, scope));
  },

  async createNote(data: InsertNote, scope: ScopeOrTrusted): Promise<Note> {
    if (!data.transaction_id && !data.client_id) {
      throw new AppError("A note must be attached to a transaction or client", 400);
    }
    // Verify ownership of EVERY supplied parent before inserting, otherwise a
    // caller could attach a note to another org's transaction or client.
    if (data.transaction_id) {
      await assertTransactionInScope(data.transaction_id, scope);
    }
    if (data.client_id) {
      await assertClientInScope(data.client_id, scope);
    }
    // content (incl. replies) is rendered as HTML by the client.
    const safe = typeof data.content === "string" ? { ...data, content: sanitizeRichText(data.content) } : data;
    return noteRepository.create(safe);
  },

  async updateNote(id: string, content: string, scope: ScopeOrTrusted): Promise<Note> {
    await loadScopedNote(id, scope);
    const note = await noteRepository.update(id, sanitizeRichText(content));
    if (!note) throw new AppError("Note not found", 404);
    return note;
  },

  async deleteNote(id: string, scope: ScopeOrTrusted): Promise<void> {
    await loadScopedNote(id, scope);
    await noteRepository.remove(id);
  },
};

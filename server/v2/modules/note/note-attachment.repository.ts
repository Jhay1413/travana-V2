import { db } from "../../config/database";
import { noteAttachments, notes, transaction, transaction, type NoteAttachment, type InsertNoteAttachment } from "@shared/schema";
import { eq, desc, asc, or, sql } from "drizzle-orm";

export const noteAttachmentRepository = {
  async findById(id: string): Promise<NoteAttachment | undefined> {
    const [result] = await db.select().from(noteAttachments).where(eq(noteAttachments.id, id)).limit(1);
    return result;
  },

  async findByNoteId(noteId: string): Promise<NoteAttachment[]> {
    return db
      .select()
      .from(noteAttachments)
      .where(eq(noteAttachments.noteId, noteId))
      .orderBy(desc(noteAttachments.createdAt));
  },

  // Every attachment on every note/reply of a deal, in one query, so the deal's
  // notes panel doesn't need one request per note.
  async findByTransactionId(transactionId: string): Promise<NoteAttachment[]> {
    const rows = await db
      .select({ attachment: noteAttachments })
      .from(noteAttachments)
      .innerJoin(notes, eq(noteAttachments.noteId, notes.id))
      .where(eq(notes.transaction_id, transactionId))
      .orderBy(desc(noteAttachments.createdAt));
    return rows.map((r) => r.attachment);
  },

  // Attachments on a client's own notes, plus (optionally) notes on any of the
  // client's deals. Oldest first.
  async findByClientId(clientId: string, includeDeals: boolean): Promise<NoteAttachment[]> {
    const onClient = eq(notes.client_id, clientId);
    const onDeals = sql`${notes.transaction_id} IN (SELECT ${transaction.id} FROM ${transaction} WHERE ${transaction.client_id} = ${clientId})`;
    const rows = await db
      .select({ attachment: noteAttachments })
      .from(noteAttachments)
      .innerJoin(notes, eq(noteAttachments.noteId, notes.id))
      .where(includeDeals ? or(onClient, onDeals) : onClient)
      .orderBy(asc(noteAttachments.createdAt));
    return rows.map((r) => r.attachment);
  },

  async create(attachment: InsertNoteAttachment): Promise<NoteAttachment> {
    const [result] = await db.insert(noteAttachments).values(attachment).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(noteAttachments).where(eq(noteAttachments.id, id));
  },
};

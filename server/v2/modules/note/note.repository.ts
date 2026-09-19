import { db } from "../../config/database";
import { notes, transaction, clientTable, user, type Note, type InsertNote } from "@shared/schema";
import { and, eq, desc, or, sql } from "drizzle-orm";
import { buildTransactionRecordScopeConds, type ScopeOrTrusted } from "../../utils/scope-conditions";

export type NoteWithAuthor = Note & { author_name: string | null };

export const noteRepository = {
  async findByTransactionId(transactionId: string): Promise<NoteWithAuthor[]> {
    const rows = await db
      .select({
        id: notes.id,
        description: notes.description,
        content: notes.content,
        agent_id: notes.agent_id,
        user_id: notes.user_id,
        createdAt: notes.createdAt,
        parent_id: notes.parent_id,
        transaction_id: notes.transaction_id,
        client_id: notes.client_id,
        author_name: user.name,
      })
      .from(notes)
      .leftJoin(user, eq(notes.agent_id, user.id))
      .where(eq(notes.transaction_id, transactionId))
      .orderBy(desc(notes.createdAt));
    return rows;
  },

  async findByClientId(
    clientId: string,
    scope: ScopeOrTrusted,
    options?: { includeDeals?: boolean },
  ): Promise<NoteWithAuthor[]> {
    // Client-level notes: attached directly to the client and not to a
    // transaction. When `includeDeals` is set, notes written on any of the
    // client's deals (transactions — enquiry/quote/booking) are merged in too,
    // resolved via transaction.client_id since deal notes usually carry no
    // client_id of their own. The deal branch also applies the same
    // record-level scope conditions the client's deal LIST already uses
    // (transaction.repository.ts findAll, clientId case) — org-wide for staff,
    // pinned to transaction.user_id for homeworkers — so a homeworker can't
    // see notes on a colleague's deal via this merged list. System notes are
    // excluded here so the (often numerous) automation rows aren't shipped
    // just to be filtered out client-side.
    const whereClause = options?.includeDeals
      ? and(
          or(
            and(eq(notes.client_id, clientId), sql`${notes.transaction_id} IS NULL`),
            and(eq(transaction.client_id, clientId), ...buildTransactionRecordScopeConds(scope)),
          ),
          sql`${notes.description} IS DISTINCT FROM 'system'`,
        )
      : and(eq(notes.client_id, clientId), sql`${notes.transaction_id} IS NULL`);

    const rows = await db
      .select({
        id: notes.id,
        description: notes.description,
        content: notes.content,
        agent_id: notes.agent_id,
        user_id: notes.user_id,
        createdAt: notes.createdAt,
        parent_id: notes.parent_id,
        transaction_id: notes.transaction_id,
        client_id: notes.client_id,
        author_name: user.name,
      })
      .from(notes)
      .leftJoin(user, eq(notes.agent_id, user.id))
      .leftJoin(transaction, eq(notes.transaction_id, transaction.id))
      .where(whereClause)
      .orderBy(desc(notes.createdAt));
    return rows;
  },

  async findById(id: string): Promise<Note | undefined> {
    const [result] = await db.select().from(notes).where(eq(notes.id, id));
    return result;
  },

  async findByIdWithOrg(id: string) {
    // Resolve org via either note.client_id directly OR note.transaction_id → transaction.client_id.
    const [result] = await db
      .select({
        id: notes.id,
        transaction_id: notes.transaction_id,
        client_id: notes.client_id,
        // COALESCE: prefer the note's own client_id, fall back to the transaction's client_id.
        orgId: sql<string | null>`COALESCE(direct_client.org_id, txn_client.org_id)`,
      })
      .from(notes)
      .leftJoin(sql`${clientTable} AS direct_client`, sql`direct_client.id = ${notes.client_id}`)
      .leftJoin(transaction, eq(notes.transaction_id, transaction.id))
      .leftJoin(sql`${clientTable} AS txn_client`, sql`txn_client.id = ${transaction.client_id}`)
      .where(eq(notes.id, id))
      .limit(1);
    return result ?? null;
  },

  async transactionBelongsToOrg(transactionId: string, orgId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: transaction.id })
      .from(transaction)
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(and(eq(transaction.id, transactionId), eq(clientTable.orgId, orgId)))
      .limit(1);
    return !!row;
  },

  async clientBelongsToOrg(clientId: string, orgId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: clientTable.id })
      .from(clientTable)
      .where(and(eq(clientTable.id, clientId), eq(clientTable.orgId, orgId)))
      .limit(1);
    return !!row;
  },

  async create(note: InsertNote): Promise<Note> {
    const [result] = await db.insert(notes).values(note).returning();
    return result;
  },

  async update(id: string, content: string): Promise<Note | undefined> {
    const [result] = await db.update(notes).set({ content }).where(eq(notes.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(notes).where(eq(notes.id, id));
  },
};

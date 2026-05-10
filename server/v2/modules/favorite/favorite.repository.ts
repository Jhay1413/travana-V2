import { db } from '../../config/database';
import {
  favorites,
  clientTable,
  transaction,
  enquiry_table,
  quote,
  booking,
} from '@shared/schema';
import { eq, and, asc, inArray } from 'drizzle-orm';

export type FavoriteWithClient = typeof favorites.$inferSelect & {
  clientId: string | null;
  clientName: string | null;
};

export const favoriteRepository = {
  async findByUserId(userId: string): Promise<FavoriteWithClient[]> {
    const rows = await db
      .select()
      .from(favorites)
      .where(eq(favorites.userId, userId))
      .orderBy(asc(favorites.displayOrder));

    if (rows.length === 0) return [];

    const transactionIds = rows.filter((f) => f.itemType === "transaction").map((f) => f.itemId);
    const enquiryIds = rows.filter((f) => f.itemType === "enquiry").map((f) => f.itemId);
    const quoteIds = rows.filter((f) => f.itemType === "quote").map((f) => f.itemId);
    const bookingIds = rows.filter((f) => f.itemType === "booking").map((f) => f.itemId);
    const directClientIds = rows.filter((f) => f.itemType === "client").map((f) => f.itemId);

    const clientIdByItem = new Map<string, string>();
    const collect = async () => {
      if (transactionIds.length > 0) {
        const txs = await db
          .select({ id: transaction.id, client_id: transaction.client_id })
          .from(transaction)
          .where(inArray(transaction.id, transactionIds));
        for (const t of txs) {
          if (t.client_id) clientIdByItem.set(`transaction:${t.id}`, t.client_id);
        }
      }
      if (enquiryIds.length > 0) {
        const enqs = await db
          .select({ id: enquiry_table.id, client_id: transaction.client_id })
          .from(enquiry_table)
          .innerJoin(transaction, eq(enquiry_table.transaction_id, transaction.id))
          .where(inArray(enquiry_table.id, enquiryIds));
        for (const e of enqs) {
          if (e.client_id) clientIdByItem.set(`enquiry:${e.id}`, e.client_id);
        }
      }
      if (quoteIds.length > 0) {
        const qs = await db
          .select({ id: quote.id, client_id: transaction.client_id })
          .from(quote)
          .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
          .where(inArray(quote.id, quoteIds));
        for (const q of qs) {
          if (q.client_id) clientIdByItem.set(`quote:${q.id}`, q.client_id);
        }
      }
      if (bookingIds.length > 0) {
        const bs = await db
          .select({ id: booking.id, client_id: transaction.client_id })
          .from(booking)
          .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
          .where(inArray(booking.id, bookingIds));
        for (const b of bs) {
          if (b.client_id) clientIdByItem.set(`booking:${b.id}`, b.client_id);
        }
      }
      for (const cid of directClientIds) {
        clientIdByItem.set(`client:${cid}`, cid);
      }
    };
    await collect();

    const allClientIds = Array.from(new Set([...clientIdByItem.values()]));
    const clientNameMap = new Map<string, string>();
    if (allClientIds.length > 0) {
      const clients = await db
        .select({
          id: clientTable.id,
          title: clientTable.title,
          firstName: clientTable.firstName,
          surename: clientTable.surename,
        })
        .from(clientTable)
        .where(inArray(clientTable.id, allClientIds));
      for (const c of clients) {
        const title = c.title && c.title !== "NULL" ? c.title : "";
        const name = [title, c.firstName, c.surename].filter(Boolean).join(" ");
        clientNameMap.set(c.id, name);
      }
    }

    return rows.map((f) => {
      const clientId = clientIdByItem.get(`${f.itemType}:${f.itemId}`) ?? null;
      const clientName = clientId ? clientNameMap.get(clientId) ?? null : null;
      return { ...f, clientId, clientName };
    });
  },

  async findById(id: string) {
    const [row] = await db.select().from(favorites).where(eq(favorites.id, id)).limit(1);
    return row || undefined;
  },

  async findByUserAndItem(userId: string, itemType: string, itemId: string) {
    const [row] = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.itemType, itemType), eq(favorites.itemId, itemId)))
      .limit(1);
    return row || undefined;
  },

  async create(data: any) {
    const [row] = await db.insert(favorites).values(data).returning();
    return row;
  },

  async update(id: string, data: any) {
    const [row] = await db.update(favorites).set(data).where(eq(favorites.id, id)).returning();
    return row || undefined;
  },

  async remove(id: string) {
    await db.delete(favorites).where(eq(favorites.id, id));
  },
};

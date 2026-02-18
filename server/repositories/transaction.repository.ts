import { db } from "../config/database";
import { transaction, enquiry_table, quote, booking, clientTable, user, enquiry_destination, enquiry_resorts, enquiry_accomodation, enquiry_board_basis, enquiry_departure_airport, destination, package_type, deal_images, quoteImages } from "@shared/schema";
import type { Transaction, InsertTransaction } from "@shared/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";

async function enrichTransactions(txns: Transaction[]) {
  if (txns.length === 0) return [];
  const txnIds = txns.map(t => t.id);

  const [allEnquiries, allQuotes, allBookings, allPackageTypes] = await Promise.all([
    db.select().from(enquiry_table).where(inArray(enquiry_table.transaction_id, txnIds)),
    db.select().from(quote).where(inArray(quote.transaction_id, txnIds)),
    db.select().from(booking).where(inArray(booking.transaction_id, txnIds)),
    db.select().from(package_type),
  ]);

  const packageTypeMap = new Map(allPackageTypes.map(pt => [pt.id, pt.name]));

  const enquiryIds = allEnquiries.map(e => e.id);
  let allDestinations: any[] = [];
  if (enquiryIds.length > 0) {
    allDestinations = await db.select({
      enquiry_id: enquiry_destination.enquiry_id,
      destination_id: enquiry_destination.destination_id,
      name: destination.name,
      country_id: destination.country_id,
    }).from(enquiry_destination)
      .leftJoin(destination, eq(enquiry_destination.destination_id, destination.id))
      .where(inArray(enquiry_destination.enquiry_id, enquiryIds));
  }

  const quoteIds = allQuotes.map(q => q.id);
  const bookingIds = allBookings.map(b => b.id);
  const ownerIds = [...quoteIds, ...bookingIds];
  let allImages: any[] = [];
  if (ownerIds.length > 0) {
    const [dealImgs, quoteImgs] = await Promise.all([
      db.select().from(deal_images).where(inArray(deal_images.owner_id, ownerIds)),
      quoteIds.length > 0
        ? db.select().from(quoteImages).where(inArray(quoteImages.quoteId, quoteIds))
        : Promise.resolve([]),
    ]);
    allImages = [
      ...dealImgs,
      ...quoteImgs.map(qi => ({
        id: qi.id,
        owner_id: qi.quoteId,
        image_url: qi.url,
        isPrimary: qi.isPrimary,
      })),
    ];
  }

  const enquiryMap = new Map<string, any>();
  for (const enq of allEnquiries) {
    const destinations = allDestinations.filter(d => d.enquiry_id === enq.id);
    enquiryMap.set(enq.transaction_id, {
      ...enq,
      destinations,
      holiday_type_name: packageTypeMap.get(enq.holiday_type_id) || enq.holiday_type_id,
    });
  }

  const quotesMap = new Map<string, any[]>();
  for (const q of allQuotes) {
    const images = allImages.filter(img => img.owner_id === q.id);
    const entry = {
      ...q,
      holiday_type_name: packageTypeMap.get(q.holiday_type_id) || q.holiday_type_id,
      images,
    };
    if (!quotesMap.has(q.transaction_id)) quotesMap.set(q.transaction_id, []);
    quotesMap.get(q.transaction_id)!.push(entry);
  }

  const bookingMap = new Map<string, any>();
  for (const b of allBookings) {
    const images = allImages.filter(img => img.owner_id === b.id);
    bookingMap.set(b.transaction_id, {
      ...b,
      holiday_type_name: packageTypeMap.get(b.holiday_type_id) || b.holiday_type_id,
      images,
    });
  }

  return txns.map(txn => {
    const enquiry = enquiryMap.get(txn.id) || null;
    const quotes = quotesMap.get(txn.id) || [];
    const bookingEntry = bookingMap.get(txn.id) || null;
    const holiday_type_name = enquiry?.holiday_type_name || quotes[0]?.holiday_type_name || bookingEntry?.holiday_type_name || null;
    return {
      ...txn,
      holiday_type_name,
      enquiry,
      quotes,
      booking: bookingEntry,
    };
  });
}

export const transactionRepository = {
  async findById(id: string): Promise<Transaction | undefined> {
    const [result] = await db.select().from(transaction).where(eq(transaction.id, id)).limit(1);
    return result;
  },

  async findAll() {
    const txns = await db.select().from(transaction).orderBy(desc(transaction.created_at));
    return enrichTransactions(txns);
  },

  async findByClientId(clientId: string) {
    const txns = await db.select().from(transaction).where(eq(transaction.client_id, clientId)).orderBy(desc(transaction.created_at));
    return enrichTransactions(txns);
  },

  async findByAgentId(agentId: string) {
    const txns = await db.select().from(transaction).where(eq(transaction.agent_id, agentId)).orderBy(desc(transaction.created_at));
    return enrichTransactions(txns);
  },

  async findByStatus(status: string): Promise<Transaction[]> {
    return await db.select().from(transaction).where(eq(transaction.status, status as any)).orderBy(desc(transaction.created_at));
  },

  async create(data: InsertTransaction): Promise<Transaction> {
    const [result] = await db.insert(transaction).values(data).returning();
    return result;
  },

  async update(id: string, data: Partial<InsertTransaction>): Promise<Transaction | undefined> {
    const [result] = await db.update(transaction).set(data).where(eq(transaction.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(transaction).where(eq(transaction.id, id));
  },

  async findWithDetails(id: string) {
    const [txn] = await db.select().from(transaction).where(eq(transaction.id, id)).limit(1);
    if (!txn) return undefined;

    const [enquiryResult] = await db.select().from(enquiry_table).where(eq(enquiry_table.transaction_id, id)).limit(1);
    const quotes = await db.select().from(quote).where(eq(quote.transaction_id, id));
    const [bookingResult] = await db.select().from(booking).where(eq(booking.transaction_id, id)).limit(1);
    const [client] = txn.client_id ? await db.select().from(clientTable).where(eq(clientTable.id, txn.client_id)).limit(1) : [undefined];
    const [agent] = txn.agent_id ? await db.select().from(user).where(eq(user.id, txn.agent_id)).limit(1) : [undefined];

    let enrichedEnquiry: any = enquiryResult || null;
    if (enquiryResult) {
      const [destinations, resorts, accommodations, boardBases, airports] = await Promise.all([
        db.select({
          enquiry_id: enquiry_destination.enquiry_id,
          destination_id: enquiry_destination.destination_id,
          country_id: destination.country_id,
        }).from(enquiry_destination)
          .leftJoin(destination, eq(enquiry_destination.destination_id, destination.id))
          .where(eq(enquiry_destination.enquiry_id, enquiryResult.id)),
        db.select().from(enquiry_resorts).where(eq(enquiry_resorts.enquiry_id, enquiryResult.id)),
        db.select().from(enquiry_accomodation).where(eq(enquiry_accomodation.enquiry_id, enquiryResult.id)),
        db.select().from(enquiry_board_basis).where(eq(enquiry_board_basis.enquiry_id, enquiryResult.id)),
        db.select().from(enquiry_departure_airport).where(eq(enquiry_departure_airport.enquiry_id, enquiryResult.id)),
      ]);
      enrichedEnquiry = {
        ...enquiryResult,
        destinations,
        resorts,
        accommodations,
        boardBases,
        airports,
      };
    }

    return {
      ...txn,
      enquiry: enrichedEnquiry,
      quotes,
      booking: bookingResult || null,
      client: client || null,
      agent: agent || null,
    };
  },

  async getStats() {
    const [result] = await db.select({
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) FILTER (WHERE ${transaction.is_active} = true)`,
      enquiry: sql<number>`count(*) FILTER (WHERE ${transaction.status} = 'ENQUIRY')`,
      quoted: sql<number>`count(*) FILTER (WHERE ${transaction.status} = 'QUOTED')`,
      booked: sql<number>`count(*) FILTER (WHERE ${transaction.status} = 'BOOKED')`,
    }).from(transaction);
    return result;
  },
};

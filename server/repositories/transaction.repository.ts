import { db } from "../config/database";
import { transaction, enquiry_table, quote, booking, clientTable, user, enquiry_destination, enquiry_resorts, enquiry_accomodation, enquiry_board_basis, enquiry_departure_airport, destination } from "@shared/schema";
import type { Transaction, InsertTransaction } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export const transactionRepository = {
  async findById(id: string): Promise<Transaction | undefined> {
    const [result] = await db.select().from(transaction).where(eq(transaction.id, id)).limit(1);
    return result;
  },

  async findAll(): Promise<Transaction[]> {
    return await db.select().from(transaction).orderBy(desc(transaction.created_at));
  },

  async findByClientId(clientId: string): Promise<Transaction[]> {
    return await db.select().from(transaction).where(eq(transaction.client_id, clientId)).orderBy(desc(transaction.created_at));
  },

  async findByAgentId(agentId: string): Promise<Transaction[]> {
    return await db.select().from(transaction).where(eq(transaction.agent_id, agentId)).orderBy(desc(transaction.created_at));
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

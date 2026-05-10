import { db } from "../../config/database";
import { travel_deal, quote, transaction, clientTable } from "@shared/schema";
import type { TravelDeal, InsertTravelDeal } from "@shared/schema";
import { and, eq } from "drizzle-orm";

export const socialPostRepository = {
  async create(data: InsertTravelDeal): Promise<TravelDeal> {
    const [result] = await db.insert(travel_deal).values(data).returning();
    return result;
  },

  async findByQuoteId(quoteId: string): Promise<TravelDeal | undefined> {
    const [result] = await db
      .select()
      .from(travel_deal)
      .where(eq(travel_deal.quote_id, quoteId))
      .limit(1);
    return result;
  },

  async findById(id: string): Promise<TravelDeal | undefined> {
    const [result] = await db
      .select()
      .from(travel_deal)
      .where(eq(travel_deal.id, id))
      .limit(1);
    return result;
  },

  async findByIdWithOrg(id: string) {
    const [result] = await db
      .select({
        id: travel_deal.id,
        quote_id: travel_deal.quote_id,
        clientOrgId: clientTable.orgId,
      })
      .from(travel_deal)
      .leftJoin(quote, eq(travel_deal.quote_id, quote.id))
      .leftJoin(transaction, eq(quote.transaction_id, transaction.id))
      .leftJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(eq(travel_deal.id, id))
      .limit(1);
    return result ?? null;
  },

  async quoteBelongsToOrg(quoteId: string, orgId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: quote.id })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(and(eq(quote.id, quoteId), eq(clientTable.orgId, orgId)))
      .limit(1);
    return !!row;
  },

  async update(id: string, data: Partial<InsertTravelDeal>): Promise<TravelDeal> {
    const [result] = await db
      .update(travel_deal)
      .set(data)
      .where(eq(travel_deal.id, id))
      .returning();
    return result;
  },

  async findAll(): Promise<TravelDeal[]> {
    return await db.select().from(travel_deal);
  },
};

import { db } from "../config/database";
import { travel_deal } from "@shared/schema";
import type { TravelDeal, InsertTravelDeal } from "@shared/schema";
import { eq } from "drizzle-orm";

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

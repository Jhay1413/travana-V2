import { db } from "../../config/database";
import {
  travel_deal,
  quote,
  transaction,
  quote_accomodation,
  accomodation_list,
  accommodation_images,
  lodge_images,
  lodges,
  park,
} from "@shared/schema";
import type { TravelDeal, InsertTravelDeal } from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";

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
    // Scope by the transaction's org rather than the client's — marketing/social
    // deals often have no client, which would otherwise leave the org null.
    const [result] = await db
      .select({
        id: travel_deal.id,
        quote_id: travel_deal.quote_id,
        orgId: transaction.org_id,
      })
      .from(travel_deal)
      .leftJoin(quote, eq(travel_deal.quote_id, quote.id))
      .leftJoin(transaction, eq(quote.transaction_id, transaction.id))
      .where(eq(travel_deal.id, id))
      .limit(1);
    return result ?? null;
  },

  async quoteBelongsToOrg(quoteId: string, orgId: string): Promise<boolean> {
    // Scope by transaction.org_id (the canonical pattern) rather than the client's
    // org — free/marketing quotes used for social posts often have no client, so a
    // client join would wrongly exclude them.
    const [row] = await db
      .select({ id: quote.id })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .where(and(eq(quote.id, quoteId), eq(transaction.org_id, orgId)))
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

  /**
   * Aggregate every image source for a quote: accommodation images, lodge
   * images, the lodge's primary image, and park images. Used by the
   * social-post composer to populate its image picker.
   */
  async isTestTransactionForQuote(quoteId: string): Promise<boolean> {
    const [row] = await db
      .select({ is_test: transaction.is_test })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .where(eq(quote.id, quoteId))
      .limit(1);
    return !!row?.is_test;
  },

  async findAllImagesForQuote(quoteId: string): Promise<Array<{ url: string; name: string; source: string; isPrimary: boolean }>> {
    const images: Array<{ url: string; name: string; source: string; isPrimary: boolean }> = [];

    const quoteAccoms = await db
      .select({
        accomodation_id: quote_accomodation.accomodation_id,
        accomodation_name: accomodation_list.name,
      })
      .from(quote_accomodation)
      .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
      .where(eq(quote_accomodation.quote_id, quoteId));

    const accomIds = quoteAccoms.map((a) => a.accomodation_id).filter((id): id is string => !!id);

    if (accomIds.length > 0) {
      const accomImgs = await db
        .select()
        .from(accommodation_images)
        .where(inArray(accommodation_images.accommodation_id, accomIds));

      for (const img of accomImgs) {
        const accom = quoteAccoms.find((a) => a.accomodation_id === img.accommodation_id);
        images.push({
          url: img.image_url,
          name: accom?.accomodation_name || "Accommodation",
          source: "accommodation",
          isPrimary: img.isPrimary ?? false,
        });
      }
    }

    const [quoteRecord] = await db
      .select({ lodge_id: quote.lodge_id, cottage_id: quote.cottage_id })
      .from(quote)
      .where(eq(quote.id, quoteId));

    if (quoteRecord?.lodge_id) {
      const lodgeImgs = await db
        .select({
          image_url: lodge_images.image_url,
          isPrimary: lodge_images.isPrimary,
          lodge_name: lodges.lodge_name,
        })
        .from(lodge_images)
        .leftJoin(lodges, eq(lodge_images.lodge_id, lodges.id))
        .where(eq(lodge_images.lodge_id, quoteRecord.lodge_id));

      for (const img of lodgeImgs) {
        images.push({
          url: img.image_url,
          name: img.lodge_name || "Lodge",
          source: "lodge",
          isPrimary: img.isPrimary ?? false,
        });
      }

      const [lodge] = await db
        .select({ image: lodges.image, lodge_name: lodges.lodge_name, park_id: lodges.park_id })
        .from(lodges)
        .where(eq(lodges.id, quoteRecord.lodge_id));

      if (lodge?.image) {
        images.push({ url: lodge.image, name: lodge.lodge_name || "Lodge", source: "lodge", isPrimary: false });
      }

      if (lodge?.park_id) {
        const [parkRecord] = await db
          .select({ image_1: park.image_1, image_2: park.image_2, name: park.name })
          .from(park)
          .where(eq(park.id, lodge.park_id));

        if (parkRecord?.image_1) {
          images.push({ url: parkRecord.image_1, name: parkRecord.name || "Park", source: "park", isPrimary: false });
        }
        if (parkRecord?.image_2) {
          images.push({ url: parkRecord.image_2, name: parkRecord.name || "Park", source: "park", isPrimary: false });
        }
      }
    }

    return images;
  },
};

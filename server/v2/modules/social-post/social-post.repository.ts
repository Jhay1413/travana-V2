import { db } from "../../config/database";
import {
  travel_deal,
  quote,
  transaction,
  quote_accomodation,
  accomodation_list,
  quoteImages,
  deal_images,
  organization,
} from "@shared/schema";
import type { TravelDeal, InsertTravelDeal } from "@shared/schema";
import type { OrganizationBranding } from "./social-post.types";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";

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

  async findOrgIdForQuote(quoteId: string): Promise<string | null> {
    const [row] = await db
      .select({ orgId: transaction.org_id })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .where(eq(quote.id, quoteId))
      .limit(1);
    return row?.orgId ?? null;
  },

  /** Batch, org-agnostic projection of SCHEDULED deals for the embeddings
   *  backfill script. "Scheduled" = onlySocialsId set (same definition the
   *  social-posts board uses). Requires a non-null transaction.org_id since
   *  ai_embeddings rows must be org-scoped, and excludes test transactions.
   *  Includes the quote's primary hotel name (scalar subquery — a join would
   *  duplicate rows for multi-accommodation quotes). Ordered by created_at
   *  for stable paging. */
  async findScheduledDealEmbeddingRows(
    offset: number,
    limit: number,
  ): Promise<Array<{ deal: TravelDeal; orgId: string; hotelName: string | null }>> {
    const rows = await db
      .select({
        deal: travel_deal,
        orgId: transaction.org_id,
        // Table objects interpolated (NOT hand-written names) so the real DB
        // table names resolve — e.g. accomodation_list lives in the DB as
        // "accomodation_list_table".
        hotelName: sql<string | null>`(
          SELECT al.name FROM ${quote_accomodation} qa
          LEFT JOIN ${accomodation_list} al ON qa.accomodation_id = al.id
          WHERE qa.quote_id = ${travel_deal.quote_id}
          ORDER BY qa.is_primary DESC NULLS LAST
          LIMIT 1
        )`,
      })
      .from(travel_deal)
      .innerJoin(quote, eq(travel_deal.quote_id, quote.id))
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .where(
        and(
          isNotNull(travel_deal.onlySocialsId),
          eq(transaction.is_test, false),
          isNotNull(transaction.org_id),
        ),
      )
      .orderBy(travel_deal.created_at, travel_deal.id)
      .limit(limit)
      .offset(offset);
    return rows.map((r) => ({ deal: r.deal, orgId: r.orgId as string, hotelName: r.hotelName ?? null }));
  },

  /** The quote's primary accommodation name, for the deal-embedding sync hook. */
  async findPrimaryAccommodationNameForQuote(quoteId: string): Promise<string | null> {
    const [row] = await db
      .select({ name: accomodation_list.name })
      .from(quote_accomodation)
      .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
      .where(eq(quote_accomodation.quote_id, quoteId))
      .orderBy(desc(quote_accomodation.is_primary))
      .limit(1);
    return row?.name ?? null;
  },

  async findOrganizationBrandingById(orgId: string): Promise<OrganizationBranding | null> {
    const [row] = await db
      .select({ name: organization.name, settings: organization.settings })
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1);
    if (!row) return null;
    return { name: row.name, settings: (row.settings as Record<string, unknown>) ?? {} };
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
   * The quote's own gallery, resolved exactly the way the quote view/edit
   * screen resolves it (quote.repository findWithDetails): quote_images first,
   * falling back to this quote's legacy deal_images rows, deduped by URL and
   * ordered by position.
   *
   * The shared accommodation/lodge/park libraries are deliberately NOT merged
   * in. Uploads are copied into those libraries on save (quote.service
   * saveImagesToAccommodation/saveImagesToLodge) as separate rows, so reading
   * them back here returned the same photo two or three times — once per
   * library — and the composer auto-selects everything, so each copy was
   * uploaded to OnlySocials as its own media item.
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
    const [ownImages, legacyDealImages, displayName] = await Promise.all([
      db
        .select({ url: quoteImages.url, isPrimary: quoteImages.isPrimary })
        .from(quoteImages)
        .where(eq(quoteImages.quoteId, quoteId))
        .orderBy(asc(quoteImages.position), asc(quoteImages.id)),
      // Legacy fallback: deal_images owned by this quote (owner_id = quote id),
      // used only when the quote has no quote_images rows.
      db
        .select({ url: deal_images.image_url, isPrimary: deal_images.isPrimary })
        .from(deal_images)
        .where(eq(deal_images.owner_id, quoteId)),
      this.findPrimaryAccommodationNameForQuote(quoteId),
    ]);

    const rows = ownImages.length > 0 ? ownImages : legacyDealImages;

    const seen = new Set<string>();
    const images: Array<{ url: string; name: string; source: string; isPrimary: boolean }> = [];
    for (const row of rows) {
      if (!row.url || seen.has(row.url)) continue;
      seen.add(row.url);
      images.push({
        url: row.url,
        name: displayName || "Quote",
        source: "quote",
        isPrimary: row.isPrimary ?? false,
      });
    }
    return images;
  },
};

// Intentionally outside the shop/homeworker partition: portal reads are client-facing and token-gated, not staff reads.
import { db } from '../../config/database';
import {
  transaction,
  clientTable,
  organization,
  portalMessages,
  webauthnCredentials,
  quote,
  quote_accomodation,
  accomodation_list,
  resorts,
  destination,
  country,
  quoteImages,
  accommodation_images,
  booking,
  booking_accomodation,
  board_basis,
  tour_operator,
  bookingImages,
  deal_images,
  lodge_images,
  quoteTags,
  tags,
  clientTags,
} from '@shared/schema';
import { quoteExtrasTotalExpr, bookingExtrasTotalExpr } from '../../utils/commission-sql';
import { and, asc, desc, eq, exists, ilike, inArray, isNotNull, isNull, notExists, notInArray, or, sql, type SQL } from 'drizzle-orm';
import type { LoginCandidate, WebauthnCredentialRow } from './portal.types';

/** The quote belongs to a transaction of the given agency. Every portal deal read
 *  goes through this so one agency's deals can never reach another's clients. */
const quoteInOrg = (orgId: string) =>
  exists(
    db.select({ one: sql`1` })
      .from(transaction)
      .where(and(eq(transaction.id, quote.transaction_id), eq(transaction.org_id, orgId))),
  );

export const portalDealActiveWhere = (orgId: string) =>
  and(
    eq(quote.is_active, true),
    isNotNull(quote.quote_token),
    eq(quote.show_on_portal, true),
    eq(quote.isFreeQuote, true),
    quoteInOrg(orgId),
  );

/**
 * THE definition of a live booking, shared by the bookings list and by "this quote is already booked": active, and
 * not LOST (a LOST booking is a dead deal, not a trip; a NULL status counts as live, as the rest of the app does),
 * and not on a TEST deal (the same rule as `customerVisibleQuoteWhere`). It must be used where the booking's own deal
 * (`transaction`) is in the query: the list and detail join it, and the "quote's deal is booked" sub-queries read the
 * outer query's `transaction`, which is that same deal.
 *
 * OWNER DECISION PENDING: whether a real booking on a deactivated deal should disappear. If so, add
 * `eq(transaction.is_active, true),` to the `and(...)` below: this is the only place to change.
 */
export const liveBookingWhere = () =>
  and(
    eq(booking.is_active, true),
    eq(transaction.is_test, false),
    or(isNull(booking.booking_status), sql`${booking.booking_status} <> 'LOST'`),
  );

/** EXISTS filter: true when the quote has at least one of the given tag ids.
 *  Shared by findDeals's opt-in interest filter and findForYouDeals's mandatory
 *  one, so their tag-match semantics can't drift apart. Caller must ensure
 *  tagIds is non-empty. */
const quoteHasAnyTag = (tagIds: string[]) =>
  exists(
    db.select({ one: sql`1` })
      .from(quoteTags)
      .where(and(eq(quoteTags.quoteId, quote.id), inArray(quoteTags.tagId, tagIds))),
  );

export interface PortalDealRow {
  id: string;
  token: string | null;
  title: string | null;
  salesPrice: string | null;
  travelDate: string | Date | null;
  numNights: number | null;
  accommodationName: string | null;
  destinationName: string | null;
  countryName: string | null;
  portalAddedAt?: Date | string | null;
}

export interface PortalBookingRow {
  bookingId: string;
  quoteId: string | null;
  lodgeId: string | null;
  title: string | null;
  haysRef: string | null;
  supplierRef: string | null;
  salesPrice: string | null;
  discounts: string | null;
  serviceCharge: string | null;
  /** Cost of extras not included in the package (added to the customer total). */
  extrasTotal: string | number | null;
  adult: number | null;
  child: number | null;
  infant?: number | null;
  travelDate: string | Date;
  numNights: number | null;
  accommodationName: string | null;
  destinationName: string | null;
  countryName: string | null;
  operatorName?: string | null;
  boardName?: string | null;
}

/** The message the agent receives when a customer taps "I'm interested" on a deal. The wording must not change. */
export const DEAL_INTEREST_PREFIX = '❤️ Interested in deal: ';
const DEAL_INTEREST_LEGACY_PREFIX = 'Interested in deal: ';

/** The deal id in a stored "interested" message (either wording), or null for any other text. */
export function dealIdFromInterestText(text: string): string | null {
  const m = /^(?:❤️ )?Interested in deal: (\S+)$/.exec(text);
  return m ? m[1] : null;
}

export const portalRepository = {
  // ── Auth (email/PIN + WebAuthn) ──────────────────────────────────────────
  /**
   * Non-deleted clients with this email, best candidate first. A row that has a
   * portal PIN sorts ahead of a PIN-less duplicate (a client copied into a
   * homeworker branch has none), then oldest first, then id so the order is
   * fully deterministic. With `orgId` only that agency's clients are returned.
   * Capped at `limit` so the number of PIN comparisons stays fixed and small.
   */
  async findLoginCandidates(email: string, orgId: string | undefined, limit: number): Promise<LoginCandidate[]> {
    return db
      .select({
        id: clientTable.id,
        email: clientTable.email,
        firstName: clientTable.firstName,
        portalPin: clientTable.portalPin,
        mustChangePin: clientTable.mustChangePin,
        orgId: clientTable.orgId,
      })
      .from(clientTable)
      // Case-insensitive match: stored emails may be mixed-case, so compare both
      // sides lower-cased rather than relying on the stored value already being
      // normalised.
      .where(and(
        sql`lower(${clientTable.email}) = ${email.toLowerCase().trim()}`,
        isNull(clientTable.deletedAt),
        orgId ? eq(clientTable.orgId, orgId) : undefined,
      ))
      .orderBy(sql`(${clientTable.portalPin} IS NOT NULL) DESC`, asc(clientTable.createdAt), asc(clientTable.id))
      .limit(limit);
  },

  /** Active agency id for a portal slug, or null when the slug is unknown/inactive. */
  async findActiveOrgIdBySlug(slug: string): Promise<string | null> {
    const [row] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(and(eq(organization.slug, slug), eq(organization.isActive, true)))
      .limit(1);
    return row?.id ?? null;
  },

  /** The agency a live (non-deleted) client belongs to; undefined when the client is gone, null orgId when unassigned. */
  async findClientOrg(clientId: string): Promise<{ orgId: string | null } | undefined> {
    const [row] = await db
      .select({ orgId: clientTable.orgId })
      .from(clientTable)
      .where(and(eq(clientTable.id, clientId), isNull(clientTable.deletedAt)))
      .limit(1);
    return row;
  },

  async findClientBasicById(clientId: string): Promise<{
    id: string;
    email: string | null;
    firstName: string | null;
    mustChangePin: boolean;
  } | undefined> {
    const [row] = await db
      .select({
        id: clientTable.id,
        email: clientTable.email,
        firstName: clientTable.firstName,
        mustChangePin: clientTable.mustChangePin,
      })
      .from(clientTable)
      .where(and(eq(clientTable.id, clientId), isNull(clientTable.deletedAt)))
      .limit(1);
    return row;
  },

  async findClientNameById(clientId: string): Promise<{ firstName: string | null; lastName: string | null } | undefined> {
    const [row] = await db
      .select({ firstName: clientTable.firstName, lastName: clientTable.surename })
      .from(clientTable)
      .where(eq(clientTable.id, clientId))
      .limit(1);
    return row;
  },

  async findClientProfile(clientId: string): Promise<{
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
    mustChangePin: boolean;
  } | undefined> {
    const [row] = await db
      .select({
        firstName: clientTable.firstName,
        lastName: clientTable.surename,
        email: clientTable.email,
        phone: clientTable.phoneNumber,
        avatarUrl: clientTable.avatarUrl,
        mustChangePin: clientTable.mustChangePin,
      })
      .from(clientTable)
      .where(and(eq(clientTable.id, clientId), isNull(clientTable.deletedAt)))
      .limit(1);
    return row;
  },

  /** True when the client exists and is not soft-deleted. Used by the portal session check. */
  async isClientActive(clientId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: clientTable.id })
      .from(clientTable)
      .where(and(eq(clientTable.id, clientId), isNull(clientTable.deletedAt)))
      .limit(1);
    return !!row;
  },

  async findVipSummary(clientId: string): Promise<{
    vipTier: string | null;
    vipEnrolledAt: Date | null;
    totalReferrals: number | null;
  } | undefined> {
    const [row] = await db
      .select({
        vipTier: clientTable.vipTier,
        vipEnrolledAt: clientTable.vipEnrolledAt,
        totalReferrals: clientTable.totalReferrals,
      })
      .from(clientTable)
      .where(eq(clientTable.id, clientId))
      .limit(1);
    return row;
  },

  /**
   * Stores a verified credential, replacing what the client had: legacy
   * (unverified) rows and any row with the same credential id go, so re-enrolling
   * on a device leaves exactly one usable row.
   */
  async replaceWebauthnCredential(maxCredentials: number, input: {
    clientId: string;
    credentialId: string;
    publicKey: string;
    counter: number;
    transports: string[];
    deviceName: string;
  }): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .delete(webauthnCredentials)
        .where(and(
          eq(webauthnCredentials.clientId, input.clientId),
          or(isNull(webauthnCredentials.verifiedAt), eq(webauthnCredentials.credentialId, input.credentialId)),
        ));
      await tx.insert(webauthnCredentials).values({
        clientId: input.clientId,
        credentialId: input.credentialId,
        publicKey: input.publicKey,
        counter: input.counter,
        transports: JSON.stringify(input.transports),
        deviceName: input.deviceName,
        verifiedAt: new Date(),
      });

      // Keep at most `maxCredentials` per customer: the oldest verified ones are replaced.
      const keep = await tx
        .select({ id: webauthnCredentials.id })
        .from(webauthnCredentials)
        .where(and(eq(webauthnCredentials.clientId, input.clientId), isNotNull(webauthnCredentials.verifiedAt)))
        .orderBy(desc(webauthnCredentials.createdAt), desc(webauthnCredentials.id))
        .limit(maxCredentials);
      if (keep.length === maxCredentials) {
        await tx
          .delete(webauthnCredentials)
          .where(and(
            eq(webauthnCredentials.clientId, input.clientId),
            isNotNull(webauthnCredentials.verifiedAt),
            notInArray(webauthnCredentials.id, keep.map((k) => k.id)),
          ));
      }
    });
  },

  /** A credential by its id, across clients (the id is globally unique in practice). */
  async findWebauthnByCredentialId(credentialId: string): Promise<WebauthnCredentialRow | undefined> {
    const [row] = await db
      .select({
        id: webauthnCredentials.id,
        clientId: webauthnCredentials.clientId,
        credentialId: webauthnCredentials.credentialId,
        publicKey: webauthnCredentials.publicKey,
        counter: webauthnCredentials.counter,
        transports: webauthnCredentials.transports,
        verifiedAt: webauthnCredentials.verifiedAt,
      })
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.credentialId, credentialId))
      .orderBy(sql`(${webauthnCredentials.verifiedAt} IS NOT NULL) DESC`, asc(webauthnCredentials.createdAt))
      .limit(1);
    return row;
  },

  async updateWebauthnCounter(id: string, counter: number): Promise<void> {
    await db.update(webauthnCredentials).set({ counter }).where(eq(webauthnCredentials.id, id));
  },

  /** Verified credentials only: legacy rows cannot sign in, so they do not count as Face ID being set up. */
  async findWebauthnCredentialIdsForClient(clientId: string): Promise<Array<{ id: string }>> {
    return db
      .select({ id: webauthnCredentials.id })
      .from(webauthnCredentials)
      .where(and(eq(webauthnCredentials.clientId, clientId), isNotNull(webauthnCredentials.verifiedAt)));
  },

  async findVerifiedWebauthnForClient(clientId: string): Promise<Array<{ credentialId: string; transports: string | null }>> {
    return db
      .select({ credentialId: webauthnCredentials.credentialId, transports: webauthnCredentials.transports })
      .from(webauthnCredentials)
      .where(and(eq(webauthnCredentials.clientId, clientId), isNotNull(webauthnCredentials.verifiedAt)));
  },

  async findWebauthnDevicesForClient(clientId: string): Promise<Array<{ id: string; deviceName: string | null }>> {
    return db
      .select({ id: webauthnCredentials.id, deviceName: webauthnCredentials.deviceName })
      .from(webauthnCredentials)
      .where(and(eq(webauthnCredentials.clientId, clientId), isNotNull(webauthnCredentials.verifiedAt)));
  },

  /** The customer's verified Face ID credentials, newest first (for the Account page). */
  async findWebauthnCredentialsForClient(clientId: string): Promise<Array<{ id: string; credentialId: string; createdAt: Date | null }>> {
    return db
      .select({ id: webauthnCredentials.id, credentialId: webauthnCredentials.credentialId, createdAt: webauthnCredentials.createdAt })
      .from(webauthnCredentials)
      .where(and(eq(webauthnCredentials.clientId, clientId), isNotNull(webauthnCredentials.verifiedAt)))
      .orderBy(desc(webauthnCredentials.createdAt), desc(webauthnCredentials.id));
  },

  /** Deletes one credential, only if it belongs to this customer. Resolves whether or not a row was there. */
  async deleteWebauthnCredentialForClient(clientId: string, id: string): Promise<void> {
    await db.delete(webauthnCredentials).where(and(eq(webauthnCredentials.id, id), eq(webauthnCredentials.clientId, clientId)));
  },

  // ── Deal filters / listings ──────────────────────────────────────────────
  async findDealFilters(orgId: string): Promise<{
    countries: string[];
    popularTags: Array<{ tag: string; count: number }>;
  }> {
    const baseWhere = portalDealActiveWhere(orgId);

    const [countryRows, tagRows] = await Promise.all([
      db
        .selectDistinct({ country: country.country_name })
        .from(quote)
        .leftJoin(quote_accomodation, and(eq(quote_accomodation.quote_id, quote.id), eq(quote_accomodation.is_primary, true)))
        .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
        .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
        .leftJoin(destination, eq(resorts.destination_id, destination.id))
        .leftJoin(country, eq(destination.country_id, country.id))
        .where(and(baseWhere, isNotNull(country.country_name)))
        .orderBy(asc(country.country_name)),

      db
        .select({
          tag: tags.name,
          count: sql<number>`count(${quoteTags.quoteId})::int`,
        })
        .from(tags)
        .innerJoin(quoteTags, eq(quoteTags.tagId, tags.id))
        .innerJoin(quote, eq(quote.id, quoteTags.quoteId))
        .where(baseWhere)
        .groupBy(tags.name)
        .orderBy(desc(sql`count(${quoteTags.quoteId})`))
        .limit(10),
    ]);

    return {
      countries: countryRows.map((r) => r.country).filter((c): c is string => !!c),
      popularTags: tagRows.map((r) => ({ tag: r.tag, count: r.count })),
    };
  },

  async findClientTagIds(clientId: string): Promise<string[]> {
    const rows = await db
      .select({ tagId: clientTags.tagId })
      .from(clientTags)
      .where(eq(clientTags.clientId, clientId));
    return rows.map((r) => r.tagId);
  },

  async findForYouDeals(opts: { orgId: string; clientTagIds: string[]; limit: number; recentDays?: number }): Promise<PortalDealRow[]> {
    const { orgId, clientTagIds, limit, recentDays } = opts;
    if (clientTagIds.length === 0) return [];

    const conds: SQL[] = [
      eq(quote.is_active, true),
      isNotNull(quote.quote_token),
      eq(quote.show_on_portal, true),
      eq(quote.isFreeQuote, true),
      quoteInOrg(orgId),
      quoteHasAnyTag(clientTagIds),
    ];
    // Same recency window as findDeals: a deal that has aged out of the portal is
    // expired everywhere, including a client's personalised list.
    if (recentDays && recentDays > 0) {
      conds.push(
        sql`${quote.portal_added_at} IS NOT NULL AND ${quote.portal_added_at} >= now() - make_interval(days => ${recentDays})`,
      );
    }

    return db
      .select({
        id: quote.id,
        token: quote.quote_token,
        title: quote.title,
        salesPrice: quote.sales_price,
        travelDate: quote.travel_date,
        numNights: quote.num_of_nights,
        accommodationName: accomodation_list.name,
        destinationName: destination.name,
        countryName: country.country_name,
        portalAddedAt: quote.portal_added_at,
      })
      .from(quote)
      .leftJoin(quote_accomodation, and(eq(quote_accomodation.quote_id, quote.id), eq(quote_accomodation.is_primary, true)))
      .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .leftJoin(country, eq(destination.country_id, country.id))
      .where(and(...conds))
      .orderBy(desc(quote.date_created))
      .limit(limit);
  },

  async findDeals(opts: {
    orgId: string;
    country?: string;
    tag?: string;
    limit: number;
    recentDays?: number;
    /** Restrict to deals sharing at least one tag with these tag ids — the portal
     *  client's saved Travel Interests (client_tags.tag_id, same `tags` table as
     *  quote_tags.tag_id, so this is an exact id match, no name mapping needed).
     *  Pass undefined/empty to skip the filter (e.g. client has no interests). */
    clientTagIds?: string[];
  }): Promise<PortalDealRow[]> {
    const conds: SQL[] = [
      eq(quote.is_active, true),
      isNotNull(quote.quote_token),
      eq(quote.show_on_portal, true),
      eq(quote.isFreeQuote, true),
      quoteInOrg(opts.orgId),
    ];
    // "Latest Deals" recency window: only deals added to the portal within the last
    // N days (portal_added_at). Deals age out of this list once they pass the window.
    if (opts.recentDays && opts.recentDays > 0) {
      conds.push(
        sql`${quote.portal_added_at} IS NOT NULL AND ${quote.portal_added_at} >= now() - make_interval(days => ${opts.recentDays})`,
      );
    }
    if (opts.country) conds.push(ilike(country.country_name, opts.country));
    if (opts.tag) {
      conds.push(
        exists(
          db.select({ one: sql`1` })
            .from(quoteTags)
            .innerJoin(tags, eq(tags.id, quoteTags.tagId))
            .where(and(eq(quoteTags.quoteId, quote.id), ilike(tags.name, opts.tag))),
        ),
      );
    }
    if (opts.clientTagIds && opts.clientTagIds.length > 0) {
      // EXISTS (not a join) so a deal matching several of the client's interests
      // still returns once — no DISTINCT needed.
      conds.push(quoteHasAnyTag(opts.clientTagIds));
    }

    return db
      .select({
        id: quote.id,
        token: quote.quote_token,
        title: quote.title,
        salesPrice: quote.sales_price,
        travelDate: quote.travel_date,
        numNights: quote.num_of_nights,
        accommodationName: accomodation_list.name,
        destinationName: destination.name,
        countryName: country.country_name,
        portalAddedAt: quote.portal_added_at,
      })
      .from(quote)
      .leftJoin(quote_accomodation, and(eq(quote_accomodation.quote_id, quote.id), eq(quote_accomodation.is_primary, true)))
      .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .leftJoin(country, eq(destination.country_id, country.id))
      .where(and(...conds))
      .orderBy(opts.recentDays ? desc(quote.portal_added_at) : desc(quote.date_created))
      .limit(opts.limit);
  },

  async findTagsForQuotes(quoteIds: string[]): Promise<Array<{ quoteId: string; tagName: string }>> {
    if (quoteIds.length === 0) return [];
    return db
      .select({ quoteId: quoteTags.quoteId, tagName: tags.name })
      .from(quoteTags)
      .innerJoin(tags, eq(quoteTags.tagId, tags.id))
      .where(inArray(quoteTags.quoteId, quoteIds));
  },

  async findImagesForQuotes(quoteIds: string[]): Promise<Array<{ quoteId: string | null; url: string; isPrimary: boolean | null }>> {
    if (quoteIds.length === 0) return [];
    const rows = await db
      .select({ quoteId: quoteImages.quoteId, url: quoteImages.url, isPrimary: quoteImages.isPrimary })
      .from(quoteImages)
      .where(inArray(quoteImages.quoteId, quoteIds));
    return rows.filter((r): r is { quoteId: string | null; url: string; isPrimary: boolean | null } => !!r.url);
  },

  async findAccommodationImagesForQuotes(quoteIds: string[]): Promise<Array<{ quoteId: string | null; url: string }>> {
    if (quoteIds.length === 0) return [];
    const rows = await db
      .select({ quoteId: quote_accomodation.quote_id, url: accommodation_images.image_url })
      .from(quote_accomodation)
      .innerJoin(accommodation_images, eq(accommodation_images.accommodation_id, quote_accomodation.accomodation_id))
      .where(and(inArray(quote_accomodation.quote_id, quoteIds), eq(quote_accomodation.is_primary, true)))
      .limit(quoteIds.length);
    return rows.filter((r): r is { quoteId: string | null; url: string } => !!r.url);
  },

  // ── Client quotes / bookings ─────────────────────────────────────────────
  async findClientBookings(clientId: string): Promise<PortalBookingRow[]> {
    // Resolve accommodation/destination from the booking's OWN primary accommodation
    // (booking_accomodation), mirroring the canonical booking read. The previous
    // implementation joined the transaction's latest quote accommodation, which left
    // most bookings showing "TBC" whenever that quote link didn't line up.
    return db
      .select({
        bookingId: booking.id,
        quoteId: booking.quote_id,
        lodgeId: booking.lodge_id,
        title: booking.title,
        haysRef: booking.hays_ref,
        supplierRef: booking.supplier_ref,
        salesPrice: booking.sales_price,
        discounts: booking.discounts,
        serviceCharge: booking.service_charge,
        extrasTotal: bookingExtrasTotalExpr(),
        adult: booking.adult,
        child: booking.child,
        infant: booking.infant,
        travelDate: booking.travel_date,
        numNights: booking.num_of_nights,
        accommodationName: accomodation_list.name,
        destinationName: destination.name,
        countryName: country.country_name,
        operatorName: tour_operator.name,
        boardName: board_basis.type,
      })
      .from(transaction)
      .innerJoin(booking, eq(booking.transaction_id, transaction.id))
      .leftJoin(tour_operator, eq(booking.main_tour_operator_id, tour_operator.id))
      .leftJoin(
        booking_accomodation,
        and(eq(booking_accomodation.booking_id, booking.id), eq(booking_accomodation.is_primary, true)),
      )
      .leftJoin(board_basis, eq(booking_accomodation.board_basis_id, board_basis.id))
      .leftJoin(accomodation_list, eq(booking_accomodation.accomodation_id, accomodation_list.id))
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .leftJoin(country, eq(destination.country_id, country.id))
      .where(and(
        eq(transaction.client_id, clientId),
        liveBookingWhere(),
      ))
      .orderBy(desc(booking.travel_date));
  },

  async findImagesForBookings(
    bookingIds: string[],
  ): Promise<Array<{ bookingId: string | null; url: string; isPrimary: boolean | null }>> {
    if (bookingIds.length === 0) return [];
    const rows = await db
      .select({ bookingId: bookingImages.bookingId, url: bookingImages.url, isPrimary: bookingImages.isPrimary })
      .from(bookingImages)
      .where(inArray(bookingImages.bookingId, bookingIds));
    return rows.filter(
      (r): r is { bookingId: string | null; url: string; isPrimary: boolean | null } => !!r.url,
    );
  },

  async findAccommodationImagesForBookings(
    bookingIds: string[],
  ): Promise<Array<{ bookingId: string | null; url: string; isPrimary: boolean | null }>> {
    if (bookingIds.length === 0) return [];
    const rows = await db
      .select({
        bookingId: booking_accomodation.booking_id,
        url: accommodation_images.image_url,
        isPrimary: accommodation_images.isPrimary,
      })
      .from(booking_accomodation)
      .innerJoin(
        accommodation_images,
        eq(accommodation_images.accommodation_id, booking_accomodation.accomodation_id),
      )
      .where(inArray(booking_accomodation.booking_id, bookingIds));
    return rows.filter(
      (r): r is { bookingId: string | null; url: string; isPrimary: boolean | null } => !!r.url,
    );
  },

  /** Legacy deal_images keyed by booking id (owner_id === booking.id), mirroring the
   *  canonical booking-details read's fallback source. */
  async findDealImagesForBookings(
    bookingIds: string[],
  ): Promise<Array<{ bookingId: string; url: string; isPrimary: boolean | null }>> {
    if (bookingIds.length === 0) return [];
    const rows = await db
      .select({
        bookingId: deal_images.owner_id,
        url: deal_images.image_url,
        isPrimary: deal_images.isPrimary,
      })
      .from(deal_images)
      .where(inArray(deal_images.owner_id, bookingIds));
    return rows.filter(
      (r): r is { bookingId: string; url: string; isPrimary: boolean | null } => !!r.url,
    );
  },

  /** Lodge imagery keyed by lodge id, for lodge-based bookings without other imagery. */
  async findLodgeImagesForBookings(
    lodgeIds: string[],
  ): Promise<Array<{ lodgeId: string; url: string; isPrimary: boolean | null }>> {
    if (lodgeIds.length === 0) return [];
    const rows = await db
      .select({
        lodgeId: lodge_images.lodge_id,
        url: lodge_images.image_url,
        isPrimary: lodge_images.isPrimary,
      })
      .from(lodge_images)
      .where(inArray(lodge_images.lodge_id, lodgeIds));
    return rows.filter(
      (r): r is { lodgeId: string; url: string; isPrimary: boolean | null } => !!r.url,
    );
  },

  // ── Portal messages (client-side writes / reads) ────────────────────────
  async findClientPortalMessages(clientId: string, limit: number) {
    return db
      .select()
      .from(portalMessages)
      .where(eq(portalMessages.clientId, clientId))
      .orderBy(asc(portalMessages.createdAt))
      .limit(limit);
  },

  /** The exact texts a customer's "I'm interested" on a deal is stored as (the live wording, and the one the v2 route used to send). */
  async hasClientInterestMessage(clientId: string, dealId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: portalMessages.id })
      .from(portalMessages)
      .where(and(
        eq(portalMessages.clientId, clientId),
        eq(portalMessages.sender, 'client'),
        inArray(portalMessages.text, [`${DEAL_INTEREST_PREFIX}${dealId}`, `${DEAL_INTEREST_LEGACY_PREFIX}${dealId}`]),
      ))
      .limit(1);
    return !!row;
  },

  /** Ids of the deals this customer has already told the agent about (parsed from their own sent messages). */
  async findToldDealIds(clientId: string): Promise<string[]> {
    const rows = await db
      .select({ text: portalMessages.text })
      .from(portalMessages)
      .where(and(eq(portalMessages.clientId, clientId), eq(portalMessages.sender, 'client'), ilike(portalMessages.text, '%Interested in deal: %')));
    const ids = new Set<string>();
    for (const { text } of rows) {
      const id = dealIdFromInterestText(text);
      if (id) ids.add(id);
    }
    return Array.from(ids);
  },

  async insertClientPortalMessage(clientId: string, text: string): Promise<void> {
    await db.insert(portalMessages).values({ clientId, sender: 'client', text });
  },
};

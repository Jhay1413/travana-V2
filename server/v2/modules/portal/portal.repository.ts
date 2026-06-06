import { db } from '../../config/database';
import {
  chatConversations,
  chatParticipants,
  chatMessages,
  transaction,
  clientTable,
  user,
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
  quoteTags,
  tags,
  clientTags,
} from '@shared/schema';
import { and, asc, desc, eq, exists, ilike, inArray, isNotNull, sql, type SQL } from 'drizzle-orm';

const portalDealActiveWhere = () =>
  and(
    eq(quote.is_active, true),
    isNotNull(quote.quote_token),
    eq(quote.show_on_portal, true),
    eq(quote.isFreeQuote, true),
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
}

export interface PortalQuoteRow {
  quoteId: string;
  title: string | null;
  salesPrice: string | null;
  discounts: string | null;
  serviceCharge: string | null;
  adult: number | null;
  child: number | null;
  pricePerPerson: string | null;
  travelDate: string | Date;
  numNights: number | null;
  dateExpiry: Date | string | null;
  quoteToken: string | null;
  accommodationName: string | null;
  destinationName: string | null;
  countryName: string | null;
}

export interface PortalBookingRow {
  bookingId: string;
  title: string | null;
  haysRef: string | null;
  supplierRef: string | null;
  salesPrice: string | null;
  travelDate: string | Date;
  numNights: number | null;
  accommodationName: string | null;
  destinationName: string | null;
  countryName: string | null;
}

export const portalRepository = {
  // ── Chat bridge ──────────────────────────────────────────────────────────
  async getClientName(clientId: string): Promise<string> {
    const [client] = await db
      .select({ firstName: clientTable.firstName, surename: clientTable.surename })
      .from(clientTable)
      .where(eq(clientTable.id, clientId))
      .limit(1);
    if (!client) return 'Portal Client';
    return `${(client.firstName || '').trim()} ${(client.surename || '').trim()}`.trim() || 'Portal Client';
  },

  async findActiveAgentIdForClient(clientId: string): Promise<string | null> {
    const [txn] = await db
      .select({ userId: transaction.user_id })
      .from(transaction)
      .where(and(eq(transaction.client_id, clientId), eq(transaction.is_active, true)))
      .orderBy(desc(transaction.created_at))
      .limit(1);
    return txn?.userId || null;
  },

  async findAllNonBannedAgentIds(): Promise<string[]> {
    const agents = await db
      .select({ id: user.id })
      .from(user)
      .where(sql`${user.banned} = false OR ${user.banned} IS NULL`);
    return agents.map((a) => a.id);
  },

  async findConversationByPortalClient(clientId: string): Promise<{ id: string } | undefined> {
    const [row] = await db
      .select({ id: chatConversations.id })
      .from(chatConversations)
      .where(eq(chatConversations.portalClientId, clientId))
      .limit(1);
    return row;
  },

  async findPortalClientIdForConversation(conversationId: string): Promise<string | null> {
    const [conv] = await db
      .select({ portalClientId: chatConversations.portalClientId })
      .from(chatConversations)
      .where(eq(chatConversations.id, conversationId))
      .limit(1);
    return conv?.portalClientId || null;
  },

  async listParticipantUserIds(conversationId: string): Promise<Array<{ userId: string | null }>> {
    return db
      .select({ userId: chatParticipants.userId })
      .from(chatParticipants)
      .where(eq(chatParticipants.conversationId, conversationId));
  },

  async addParticipant(conversationId: string, userId: string): Promise<void> {
    await db.insert(chatParticipants).values({ conversationId, userId });
  },

  async removeParticipant(conversationId: string, userId: string): Promise<void> {
    await db
      .delete(chatParticipants)
      .where(and(eq(chatParticipants.conversationId, conversationId), eq(chatParticipants.userId, userId)));
  },

  async createConversation(input: {
    type: string;
    name: string;
    createdBy: string;
    portalClientId: string;
    portalClientName: string;
  }): Promise<{ id: string } | undefined> {
    const [conv] = await db
      .insert(chatConversations)
      .values({
        type: input.type,
        name: input.name,
        createdBy: input.createdBy,
        portalClientId: input.portalClientId,
        portalClientName: input.portalClientName,
      })
      .onConflictDoNothing()
      .returning();
    return conv;
  },

  async insertChatMessage(input: { conversationId: string; senderId: string; content: string }): Promise<void> {
    await db.insert(chatMessages).values(input);
  },

  async touchConversation(conversationId: string): Promise<void> {
    await db
      .update(chatConversations)
      .set({ updatedAt: new Date() })
      .where(eq(chatConversations.id, conversationId));
  },

  async insertPortalMessageFromAgent(input: {
    clientId: string;
    agentId: string;
    agentName: string;
    text: string;
  }): Promise<void> {
    await db.insert(portalMessages).values({
      clientId: input.clientId,
      sender: 'agent',
      agentId: input.agentId,
      agentName: input.agentName,
      text: input.text,
    });
  },

  // ── Auth (email/PIN + WebAuthn) ──────────────────────────────────────────
  async findClientForLogin(email: string): Promise<{
    id: string;
    email: string | null;
    firstName: string | null;
    portalPin: string | null;
  } | undefined> {
    const [row] = await db
      .select({
        id: clientTable.id,
        email: clientTable.email,
        firstName: clientTable.firstName,
        portalPin: clientTable.portalPin,
      })
      .from(clientTable)
      .where(eq(clientTable.email, email.toLowerCase().trim()))
      .limit(1);
    return row;
  },

  async findClientBasicById(clientId: string): Promise<{
    id: string;
    email: string | null;
    firstName: string | null;
  } | undefined> {
    const [row] = await db
      .select({ id: clientTable.id, email: clientTable.email, firstName: clientTable.firstName })
      .from(clientTable)
      .where(eq(clientTable.id, clientId))
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
  } | undefined> {
    const [row] = await db
      .select({
        firstName: clientTable.firstName,
        lastName: clientTable.surename,
        email: clientTable.email,
        phone: clientTable.phoneNumber,
        avatarUrl: clientTable.avatarUrl,
      })
      .from(clientTable)
      .where(eq(clientTable.id, clientId))
      .limit(1);
    return row;
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

  async insertWebauthnCredential(input: {
    clientId: string;
    credentialId: string;
    publicKey: string;
    deviceName: string;
  }): Promise<void> {
    await db.insert(webauthnCredentials).values({
      clientId: input.clientId,
      credentialId: input.credentialId,
      publicKey: input.publicKey,
      deviceName: input.deviceName,
      counter: 0,
    });
  },

  async findWebauthnByCredential(clientId: string, credentialId: string) {
    const [row] = await db
      .select()
      .from(webauthnCredentials)
      .where(and(
        eq(webauthnCredentials.clientId, clientId),
        eq(webauthnCredentials.credentialId, credentialId),
      ))
      .limit(1);
    return row;
  },

  async incrementWebauthnCounter(id: string): Promise<void> {
    await db
      .update(webauthnCredentials)
      .set({ counter: sql`${webauthnCredentials.counter} + 1` })
      .where(eq(webauthnCredentials.id, id));
  },

  async findWebauthnCredentialIdsForClient(clientId: string): Promise<Array<{ id: string }>> {
    return db
      .select({ id: webauthnCredentials.id })
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.clientId, clientId))
      .limit(1);
  },

  async findWebauthnDevicesForClient(clientId: string): Promise<Array<{ id: string; deviceName: string | null }>> {
    return db
      .select({ id: webauthnCredentials.id, deviceName: webauthnCredentials.deviceName })
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.clientId, clientId));
  },

  // ── Deal filters / listings ──────────────────────────────────────────────
  async findDealFilters(): Promise<{
    countries: string[];
    popularTags: Array<{ tag: string; count: number }>;
  }> {
    const baseWhere = portalDealActiveWhere();

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

  async findForYouDeals(clientTagIds: string[], limit: number): Promise<PortalDealRow[]> {
    if (clientTagIds.length === 0) return [];
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
      })
      .from(quote)
      .leftJoin(quote_accomodation, and(eq(quote_accomodation.quote_id, quote.id), eq(quote_accomodation.is_primary, true)))
      .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .leftJoin(country, eq(destination.country_id, country.id))
      .where(and(
        eq(quote.is_active, true),
        isNotNull(quote.quote_token),
        eq(quote.isFreeQuote, true),
        exists(
          db.select({ one: sql`1` })
            .from(quoteTags)
            .where(and(eq(quoteTags.quoteId, quote.id), inArray(quoteTags.tagId, clientTagIds))),
        ),
      ))
      .orderBy(desc(quote.date_created))
      .limit(limit);
  },

  async findDeals(opts: { country?: string; tag?: string; limit: number }): Promise<PortalDealRow[]> {
    const conds: SQL[] = [
      eq(quote.is_active, true),
      isNotNull(quote.quote_token),
      eq(quote.show_on_portal, true),
      eq(quote.isFreeQuote, true),
    ];
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
      })
      .from(quote)
      .leftJoin(quote_accomodation, and(eq(quote_accomodation.quote_id, quote.id), eq(quote_accomodation.is_primary, true)))
      .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .leftJoin(country, eq(destination.country_id, country.id))
      .where(and(...conds))
      .orderBy(desc(quote.date_created))
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
  async findClientQuotes(clientId: string): Promise<PortalQuoteRow[]> {
    return db
      .select({
        quoteId: quote.id,
        title: quote.title,
        salesPrice: quote.sales_price,
        discounts: quote.discounts,
        serviceCharge: quote.service_charge,
        adult: quote.adult,
        child: quote.child,
        pricePerPerson: quote.price_per_person,
        travelDate: quote.travel_date,
        numNights: quote.num_of_nights,
        dateExpiry: quote.date_expiry,
        quoteToken: quote.quote_token,
        accommodationName: accomodation_list.name,
        destinationName: destination.name,
        countryName: country.country_name,
      })
      .from(transaction)
      .innerJoin(quote, eq(quote.transaction_id, transaction.id))
      .leftJoin(quote_accomodation, and(eq(quote_accomodation.quote_id, quote.id), eq(quote_accomodation.is_primary, true)))
      .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .leftJoin(country, eq(destination.country_id, country.id))
      .where(and(eq(transaction.client_id, clientId), eq(quote.is_active, true)))
      .orderBy(desc(quote.date_created));
  },

  async findClientBookings(clientId: string): Promise<PortalBookingRow[]> {
    return db
      .select({
        bookingId: booking.id,
        title: booking.title,
        haysRef: booking.hays_ref,
        supplierRef: booking.supplier_ref,
        salesPrice: booking.sales_price,
        travelDate: booking.travel_date,
        numNights: booking.num_of_nights,
        accommodationName: accomodation_list.name,
        destinationName: destination.name,
        countryName: country.country_name,
      })
      .from(transaction)
      .innerJoin(booking, eq(booking.transaction_id, transaction.id))
      .leftJoin(
        quote_accomodation,
        sql`${quote_accomodation.quote_id} = (
          SELECT q.id FROM quote_table q
          WHERE q.transaction_id = ${transaction.id}
          AND q.is_active = true
          ORDER BY q.date_created DESC LIMIT 1
        ) AND ${quote_accomodation.is_primary} = true`,
      )
      .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .leftJoin(country, eq(destination.country_id, country.id))
      .where(and(eq(transaction.client_id, clientId), eq(booking.is_active, true)))
      .orderBy(desc(booking.travel_date));
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

  async insertClientPortalMessage(clientId: string, text: string): Promise<void> {
    await db.insert(portalMessages).values({ clientId, sender: 'client', text });
  },
};

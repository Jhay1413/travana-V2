import { db } from "../config/database";
import { transaction, enquiry_table, quote, booking, clientTable, user, enquiry_destination, enquiry_resorts, enquiry_accomodation, enquiry_board_basis, enquiry_departure_airport, destination, package_type, deal_images, quoteImages, accommodation_images, lodge_images, booking_accomodation, park, quote_accomodation, accomodation_list, board_basis, room_type, quote_flights, airport, tour_operator, resorts, country } from "@shared/schema";
import type { Transaction, InsertTransaction } from "@shared/schema";
import { eq, desc, and, sql, inArray, count, or } from "drizzle-orm";

async function enrichTransactions(txns: Transaction[]) {
  if (txns.length === 0) return [];
  const txnIds = txns.map(t => t.id);

  const [allEnquiries, allQuotes, allBookings, allPackageTypes] = await Promise.all([
    db.select().from(enquiry_table).where(inArray(enquiry_table.transaction_id, txnIds)),
    db.select().from(quote).where(and(
      inArray(quote.transaction_id, txnIds),
      sql`(${quote.quote_status} IS NULL OR ${quote.quote_status} != 'LOST')`
    )),
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
      name: sql<string>`COALESCE(${destination.name}, ${park.name})`,
      country_id: destination.country_id,
    }).from(enquiry_destination)
      .leftJoin(destination, eq(enquiry_destination.destination_id, destination.id))
      .leftJoin(park, eq(enquiry_destination.destination_id, park.id))
      .where(inArray(enquiry_destination.enquiry_id, enquiryIds));
  }

  const quoteIds = allQuotes.map(q => q.id);
  const bookingIds = allBookings.map(b => b.id);
  const lodgeIds = allBookings.map(b => b.lodge_id).filter((id): id is string => id !== null);
  const ownerIds = [...quoteIds, ...bookingIds];
  let allDealImages: any[] = [];
  let allQuoteImages: any[] = [];
  let allAccomImages: any[] = [];
  let allLodgeImages: any[] = [];
  const fetchPromises: Promise<any>[] = [];
  if (ownerIds.length > 0) {
    fetchPromises.push(
      db.select().from(deal_images).where(inArray(deal_images.owner_id, ownerIds)).then(r => { allDealImages = r; }),
    );
  }
  if (quoteIds.length > 0) {
    fetchPromises.push(
      db.select().from(quoteImages).where(inArray(quoteImages.quoteId, quoteIds)).then(r => { allQuoteImages = r; }),
    );
  }
  if (bookingIds.length > 0) {
    fetchPromises.push(
      db.select({
        booking_id: booking_accomodation.booking_id,
        id: accommodation_images.id,
        accommodation_id: accommodation_images.accommodation_id,
        image_url: accommodation_images.image_url,
        isPrimary: accommodation_images.isPrimary,
      })
        .from(accommodation_images)
        .innerJoin(
          booking_accomodation,
          and(
            eq(booking_accomodation.accomodation_id, accommodation_images.accommodation_id),
            inArray(booking_accomodation.booking_id, bookingIds)
          )
        )
        .then(r => { allAccomImages = r; }),
    );
  }
  if (lodgeIds.length > 0) {
    fetchPromises.push(
      db.select({
        id: lodge_images.id,
        lodge_id: lodge_images.lodge_id,
        image_url: lodge_images.image_url,
        isPrimary: lodge_images.isPrimary,
      }).from(lodge_images).where(inArray(lodge_images.lodge_id, lodgeIds)).then(r => { allLodgeImages = r; }),
    );
  }
  await Promise.all(fetchPromises);

  const enquiryMap = new Map<string, any>();
  for (const enq of allEnquiries) {
    const destinations = allDestinations.filter(d => d.enquiry_id === enq.id);
    enquiryMap.set(enq.transaction_id, {
      ...enq,
      destinations,
      holiday_type_name: packageTypeMap.get(enq.holiday_type_id) || null,
    });
  }

  const quotesMap = new Map<string, any[]>();
  for (const q of allQuotes) {
    const dealImgs = allDealImages.filter(img => img.owner_id === q.id);
    const quoteImgs = allQuoteImages.filter(qi => qi.quoteId === q.id).map((qi: any) => ({
      id: qi.id,
      owner_id: qi.quoteId,
      image_url: qi.url,
      isPrimary: qi.isPrimary,
    }));
    const images = [...dealImgs, ...quoteImgs];
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
    const seen = new Set<string>();
    const images: any[] = [];
    for (const img of allDealImages.filter(img => img.owner_id === b.id)) {
      const url = img.image_url || '';
      if (url && !seen.has(url)) { seen.add(url); images.push(img); }
    }
    for (const img of allAccomImages.filter(img => img.booking_id === b.id)) {
      const url = img.image_url || '';
      if (url && !seen.has(url)) { seen.add(url); images.push({ id: img.id, image_url: url, isPrimary: img.isPrimary, owner_id: img.accommodation_id, s3Key: null }); }
    }
    if (b.lodge_id) {
      for (const img of allLodgeImages.filter((img: any) => img.lodge_id === b.lodge_id)) {
        const url = img.image_url || '';
        if (url && !seen.has(url)) { seen.add(url); images.push({ id: img.id, image_url: url, isPrimary: img.isPrimary, owner_id: img.lodge_id, s3Key: null }); }
      }
    }
    bookingMap.set(b.transaction_id, {
      ...b,
      holiday_type_name: packageTypeMap.get(b.holiday_type_id) || b.holiday_type_id,
      images,
    });
  }

  return txns.map(txn => {
    const enquiry = txn.status === "on_enquiry" ? (enquiryMap.get(txn.id) || null) : null;
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

async function enrichTransactionsLightweight(txns: Transaction[]) {
  if (txns.length === 0) return [];
  const txnIds = txns.map(t => t.id);
  const userIds = [...new Set(txns.map(t => t.user_id).filter(Boolean))] as string[];

  const [allEnquiries, allQuotes, allBookings, allPackageTypes, allUsers] = await Promise.all([
    db.select({
      id: enquiry_table.id,
      transaction_id: enquiry_table.transaction_id,
      title: enquiry_table.title,
      travel_date: enquiry_table.travel_date,
      adults: enquiry_table.adults,
      children: enquiry_table.children,
      infants: enquiry_table.infants,
      holiday_type_id: enquiry_table.holiday_type_id,
      status: enquiry_table.status,
    }).from(enquiry_table).where(inArray(enquiry_table.transaction_id, txnIds)),
    db.select({
      id: quote.id,
      transaction_id: quote.transaction_id,
      title: quote.title,
      travel_date: quote.travel_date,
      adult: quote.adult,
      child: quote.child,
      infant: quote.infant,
      sales_price: quote.sales_price,
      package_commission: quote.package_commission,
      holiday_type_id: quote.holiday_type_id,
      quote_status: quote.quote_status,
      isQuoteCopy: quote.isQuoteCopy,
    }).from(quote).where(and(
      inArray(quote.transaction_id, txnIds),
      sql`(${quote.isFreeQuote} IS NOT TRUE)`,
      sql`(${quote.isQuoteCopy} IS NOT TRUE)`,
      sql`(${quote.quote_status} IS NULL OR ${quote.quote_status} != 'LOST')`
    )),
    db.select({
      id: booking.id,
      transaction_id: booking.transaction_id,
      title: booking.title,
      travel_date: booking.travel_date,
      adult: booking.adult,
      child: booking.child,
      infant: booking.infant,
      sales_price: booking.sales_price,
      package_commission: booking.package_commission,
      holiday_type_id: booking.holiday_type_id,
    }).from(booking).where(inArray(booking.transaction_id, txnIds)),
    db.select().from(package_type),
    userIds.length > 0
      ? db.select({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.name,
          email: user.email,
        }).from(user).where(inArray(user.id, userIds))
      : Promise.resolve([]),
  ]);

  const userMap = new Map(allUsers.map((u: any) => [u.id, u]));
  const packageTypeMap = new Map(allPackageTypes.map(pt => [pt.id, pt.name]));

  const enquiryMap = new Map<string, any>();
  for (const enq of allEnquiries) {
    enquiryMap.set(enq.transaction_id, {
      ...enq,
      holiday_type_name: packageTypeMap.get(enq.holiday_type_id) || null,
    });
  }

  const quotesMap = new Map<string, any[]>();
  for (const q of allQuotes) {
    const entry = {
      ...q,
      holiday_type_name: packageTypeMap.get(q.holiday_type_id) || q.holiday_type_id,
    };
    if (!quotesMap.has(q.transaction_id)) quotesMap.set(q.transaction_id, []);
    quotesMap.get(q.transaction_id)!.push(entry);
  }

  const bookingMap = new Map<string, any>();
  for (const b of allBookings) {
    bookingMap.set(b.transaction_id, {
      ...b,
      holiday_type_name: packageTypeMap.get(b.holiday_type_id) || b.holiday_type_id,
    });
  }

  return txns.map(txn => {
    const enquiry = txn.status === "on_enquiry" ? (enquiryMap.get(txn.id) || null) : null;
    const quotes = quotesMap.get(txn.id) || [];
    const bookingEntry = bookingMap.get(txn.id) || null;
    const holiday_type_name = enquiry?.holiday_type_name || quotes[0]?.holiday_type_name || bookingEntry?.holiday_type_name || null;
    const assignedUser = txn.user_id ? (userMap.get(txn.user_id) || null) : null;
    return {
      ...txn,
      holiday_type_name,
      enquiry,
      quotes,
      booking: bookingEntry,
      assignedUser,
    };
  });
}

export const transactionRepository = {
  async findById(id: string): Promise<Transaction | undefined> {
    const [result] = await db.select().from(transaction).where(eq(transaction.id, id)).limit(1);
    return result;
  },

  async findAll(dateFrom?: Date, dateTo?: Date) {
    const conditions = [];
    
    if (dateFrom) {
      conditions.push(sql`${transaction.created_at} >= ${dateFrom.toISOString()}`);
    }
    if (dateTo) {
      conditions.push(sql`${transaction.created_at} <= ${dateTo.toISOString()}`);
    }

    let query = db.select().from(transaction);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    const txns = await query.orderBy(desc(transaction.created_at));
    return enrichTransactions(txns);
  },

  async findAllLightweight() {
    const txns = await db.select().from(transaction).orderBy(desc(transaction.created_at));
    return enrichTransactionsLightweight(txns);
  },

  async findPipelineByStatus(
    status: string,
    page: number,
    limit: number,
    agentId?: string,
    quoteStatusFilter?: string,
  ): Promise<{ items: any[]; total: number; page: number; hasMore: boolean; totalProfit: number; totalValue: number }> {
    const conditions = [eq(transaction.status, status as "on_enquiry" | "on_quote" | "in_play" | "on_booking")];
    if (agentId) {
      conditions.push(eq(transaction.user_id, agentId));
    }

    if (status === "on_enquiry") {
      conditions.push(sql`${transaction.created_at} >= NOW() - INTERVAL '7 days'`);
    }

    if (status === "on_enquiry") {
      conditions.push(
        sql`${transaction.id} IN (
          SELECT ${enquiry_table.transaction_id} FROM ${enquiry_table}
        )`
      );
    }

    if (status === "on_booking") {
      conditions.push(
        sql`${transaction.id} IN (
          SELECT ${booking.transaction_id} FROM ${booking}
          WHERE ${booking.date_created} >= DATE_TRUNC('month', NOW())
        )`
      );
    }

    if (status === "on_quote") {
      const ACTIVE_STATUSES = [
        "QUOTE_IN_PROGRESS", "QUOTE_CALL", "AWAITING_DECISION",
        "QUOTE_READY", "REQUOTE", "NEW_LEAD",
      ];
      conditions.push(
        sql`${transaction.id} IN (
          SELECT ${quote.transaction_id} FROM ${quote}
          WHERE ${quote.isFreeQuote} IS NOT TRUE
          AND ${quote.quote_status}::text IN (${sql.join(ACTIVE_STATUSES.map(s => sql`${s}`), sql`, `)})
        )`
      );
      if (quoteStatusFilter) {
        conditions.push(
          sql`${transaction.id} IN (
            SELECT ${quote.transaction_id} FROM ${quote}
            WHERE ${quote.quote_status}::text = ${quoteStatusFilter}
          )`
        );
      }
    }

    const where = and(...conditions);

    const [countResult] = await db.select({ total: count() }).from(transaction).where(where);
    const total = countResult?.total || 0;

    const allIds = await db.select({ id: transaction.id }).from(transaction).where(where);
    const allTxnIds = allIds.map(r => r.id);

    let totalProfit = 0;
    let totalValue = 0;
    if (allTxnIds.length > 0) {
      try {
        if (status === "on_quote" || status === "in_play") {
          const [agg] = await db.select({
            totalSales: sql<number>`COALESCE(SUM(COALESCE(${quote.sales_price}, 0)), 0)`,
            totalCommission: sql<number>`COALESCE(SUM(COALESCE(CAST(NULLIF(${quote.package_commission}, '') AS NUMERIC), 0)), 0)`,
          }).from(quote).where(and(
            inArray(quote.transaction_id, allTxnIds),
            sql`(${quote.isFreeQuote} IS NOT TRUE)`,
            sql`(${quote.quote_status} IS NULL OR ${quote.quote_status} != 'LOST')`,
          ));
          totalValue = Number(agg?.totalSales || 0);
          const commission = Number(agg?.totalCommission || 0);
          const profitPct = status === "on_quote" ? 0.20 : 0.28;
          totalProfit = commission > 0 ? commission * profitPct : totalValue * profitPct;
        } else if (status === "on_booking") {
          const [agg] = await db.select({
            totalValue: sql<number>`COALESCE(SUM(COALESCE(${booking.sales_price}, 0)), 0)`,
            totalProfit: sql<number>`COALESCE(SUM(COALESCE(${booking.package_commission}, 0)), 0)`,
          }).from(booking).where(inArray(booking.transaction_id, allTxnIds));
          totalValue = Number(agg?.totalValue || 0);
          totalProfit = Number(agg?.totalProfit || 0);
        }
      } catch (aggErr) {
        console.error("Pipeline aggregation error (non-fatal):", aggErr);
        totalValue = 0;
        totalProfit = 0;
      }
    }

    const txns = await db
      .select()
      .from(transaction)
      .where(where)
      .orderBy(desc(transaction.created_at))
      .limit(limit)
      .offset((page - 1) * limit);

    const enriched = await enrichTransactionsLightweight(txns);
    return {
      items: enriched,
      total,
      page,
      hasMore: page * limit < total,
      totalProfit,
      totalValue,
    };
  },

  async findByClientId(clientId: string) {
    const txns = await db.select().from(transaction).where(eq(transaction.client_id, clientId)).orderBy(desc(transaction.created_at));
    return enrichTransactions(txns);
  },

  async findByAgentId(agentId: string) {
    const txns = await db.select().from(transaction)
      .where(eq(transaction.user_id, agentId))
      .orderBy(desc(transaction.created_at));
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
    const rawQuotes = await db.select().from(quote).where(eq(quote.transaction_id, id));
    const [bookingResult] = await db.select().from(booking).where(eq(booking.transaction_id, id)).limit(1);
    const [client] = txn.client_id ? await db.select().from(clientTable).where(eq(clientTable.id, txn.client_id)).limit(1) : [undefined];
    const [agent] = txn.user_id ? await db.select().from(user).where(eq(user.id, txn.user_id)).limit(1) : [undefined];

    const quoteIds = rawQuotes.map(q => q.id);
    let allAccoms: any[] = [];
    let allFlights: any[] = [];
    if (quoteIds.length > 0) {
      const departAirport = airport;
      [allAccoms, allFlights] = await Promise.all([
        db.select({
          accommodation: quote_accomodation,
          accomodation_name: accomodation_list.name,
          board_basis_name: board_basis.type,
          room_type_name: room_type.name,
          resort_name: resorts.name,
          destination_name: destination.name,
          country_name: country.country_name,
        })
          .from(quote_accomodation)
          .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
          .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
          .leftJoin(destination, eq(resorts.destination_id, destination.id))
          .leftJoin(country, eq(destination.country_id, country.id))
          .leftJoin(board_basis, eq(quote_accomodation.board_basis_id, board_basis.id))
          .leftJoin(room_type, sql`CASE WHEN ${quote_accomodation.room_type} ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN ${quote_accomodation.room_type}::uuid ELSE NULL END = ${room_type.id}`)
          .where(inArray(quote_accomodation.quote_id, quoteIds)),
        db.select({
          flight: quote_flights,
          departing_airport_name: departAirport.airport_name,
        })
          .from(quote_flights)
          .leftJoin(departAirport, eq(quote_flights.departing_airport_id, departAirport.id))
          .where(inArray(quote_flights.quote_id, quoteIds)),
      ]);
    }

    const quotes = rawQuotes.map(q => ({
      ...q,
      accommodations: allAccoms
        .filter(a => a.accommodation.quote_id === q.id)
        .map(a => ({ ...a.accommodation, accomodation_name: a.accomodation_name, board_basis_name: a.board_basis_name, room_type_name: a.room_type_name, resort_name: a.resort_name, destination_name: a.destination_name, country_name: a.country_name })),
      flights: allFlights
        .filter(f => f.flight.quote_id === q.id)
        .map(f => ({ ...f.flight, departing_airport_name: f.departing_airport_name })),
    }));

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

import { db } from "../config/database";
import { alias } from "drizzle-orm/pg-core";
import {
  quote, quote_accomodation, quote_flights, quote_cruise,
  accomodation_list, resorts, destination, country,
  quoteImages, accommodation_images, destinationGuruTable,
  package_type, airport, board_basis, cottages, lodges, park,
} from "@shared/schema";
import { eq, and, desc, asc, isNotNull, inArray, ilike, sql, or, SQL } from "drizzle-orm";

const departAirport = alias(airport, "depart_airport");

export interface DealFilters {
  category?: string;
  sortBy?: "newest" | "price_asc" | "price_desc";
  limit?: number;
  offset?: number;
  featuredOnly?: boolean;
}

function baseConditions() {
  return [
    eq(quote.is_active, true),
    eq(quote.isFreeQuote, true),
  ];
}

function selectDealFields() {
  return {
    id: quote.id,
    title: quote.title,
    quoteType: quote.quote_type,
    salesPrice: quote.sales_price,
    pricePerPerson: quote.price_per_person,
    travelDate: quote.travel_date,
    numNights: quote.num_of_nights,
    isActive: quote.is_active,
    dateCreated: quote.date_created,
    isFeatured: quote.is_featured,
    category: package_type.name,
    destinationName: destination.name,
    countryName: country.country_name,
    parkCity: park.city,
    parkLocation: park.location,
    cottageLocation: cottages.location,
    cruiseName: quote_cruise.cruise_name,
  };
}

function buildBaseQuery() {
  return db.select(selectDealFields()).from(quote)
    .leftJoin(package_type, eq(package_type.id, quote.holiday_type_id))
    .leftJoin(
      quote_accomodation,
      and(eq(quote_accomodation.quote_id, quote.id), eq(quote_accomodation.is_primary, true)),
    )
    .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
    .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
    .leftJoin(destination, eq(resorts.destination_id, destination.id))
    .leftJoin(country, eq(destination.country_id, country.id))
    .leftJoin(cottages, eq(cottages.id, quote.cottage_id))
    .leftJoin(lodges, eq(lodges.id, quote.lodge_id))
    .leftJoin(park, eq(park.id, lodges.park_id))
    .leftJoin(quote_cruise, eq(quote_cruise.quote_id, quote.id));
}

export const publicDealsRepository = {
  async findDeals(filters: DealFilters) {
    const { category, sortBy = "newest", limit = 20, offset = 0, featuredOnly = false } = filters;

    const conditions = baseConditions();
    if (category) conditions.push(ilike(package_type.name, category));
    if (featuredOnly) conditions.push(eq(quote.is_featured, true));

    const orderClause =
      sortBy === "price_asc" ? [asc(quote.sales_price)] :
      sortBy === "price_desc" ? [desc(quote.sales_price)] :
      [desc(quote.date_created)];

    return buildBaseQuery()
      .where(and(...conditions))
      .orderBy(...orderClause)
      .limit(limit)
      .offset(offset);
  },

  async findDealById(id: string) {
    const [row] = await buildBaseQuery()
      .where(and(eq(quote.id, id), ...baseConditions()))
      .limit(1);
    return row ?? null;
  },

  async findCategories() {
    const [catRows, repResult] = await Promise.all([
      db
        .select({
          category: package_type.name,
          count: sql<number>`count(${quote.id})::int`,
          minPrice: sql<string>`min(${quote.sales_price}::numeric)`,
        })
        .from(quote)
        .leftJoin(package_type, eq(package_type.id, quote.holiday_type_id))
        .where(and(...baseConditions(), isNotNull(package_type.name)))
        .groupBy(package_type.name)
        .orderBy(package_type.name),

      db.execute<{ id: string; category: string }>(sql`
        SELECT DISTINCT ON (pt.name) q.id, pt.name AS category
        FROM quote_table q
        LEFT JOIN package_type_table pt ON pt.id = q.holiday_type_id
        WHERE q.is_active = true
          AND q."isFreeQuote" = true
          AND pt.name IS NOT NULL
        ORDER BY pt.name, q.sales_price::numeric ASC
      `),
    ]);

    return { catRows, repRows: repResult.rows };
  },

  async fetchImagesByQuoteIds(quoteIds: string[]): Promise<Record<string, string[]>> {
    if (quoteIds.length === 0) return {};

    const [directImages, accomImages] = await Promise.all([
      db
        .select({ quoteId: quoteImages.quoteId, url: quoteImages.url, isPrimary: quoteImages.isPrimary })
        .from(quoteImages)
        .where(inArray(quoteImages.quoteId, quoteIds)),
      db
        .select({ quoteId: quote_accomodation.quote_id, url: accommodation_images.image_url })
        .from(quote_accomodation)
        .innerJoin(
          accommodation_images,
          eq(accommodation_images.accommodation_id, quote_accomodation.accomodation_id),
        )
        .where(and(
          sql`${quote_accomodation.quote_id} = ANY(${quoteIds})`,
          eq(quote_accomodation.is_primary, true),
        )),
    ]);

    const imageMap: Record<string, string[]> = {};
    const primaryMap: Record<string, string> = {};

    for (const img of directImages) {
      if (!img.quoteId) continue;
      if (!imageMap[img.quoteId]) imageMap[img.quoteId] = [];
      if (img.url) imageMap[img.quoteId].push(img.url);
      if (img.isPrimary && img.url) primaryMap[img.quoteId] = img.url;
    }

    for (const img of accomImages) {
      if (!img.quoteId || imageMap[img.quoteId]?.length > 0) continue;
      if (!imageMap[img.quoteId]) imageMap[img.quoteId] = [];
      imageMap[img.quoteId].push(img.url);
    }

    for (const id of quoteIds) {
      const primary = primaryMap[id];
      if (primary && imageMap[id]) {
        const idx = imageMap[id].indexOf(primary);
        if (idx > 0) {
          imageMap[id].splice(idx, 1);
          imageMap[id].unshift(primary);
        }
      }
    }

    return imageMap;
  },

  async fetchAirportsByQuoteIds(quoteIds: string[]): Promise<Record<string, string>> {
    if (quoteIds.length === 0) return {};

    const rows = await db
      .select({
        quoteId: quote_flights.quote_id,
        airportName: departAirport.airport_name,
      })
      .from(quote_flights)
      .innerJoin(departAirport, eq(departAirport.id, quote_flights.departing_airport_id))
      .where(sql`${quote_flights.quote_id} = ANY(${quoteIds})`)
      .orderBy(quote_flights.leg_order);

    const map: Record<string, string> = {};
    for (const r of rows) {
      if (r.quoteId && !map[r.quoteId] && r.airportName) {
        map[r.quoteId] = r.airportName;
      }
    }
    return map;
  },

  async fetchGuruByDestinations(names: string[]): Promise<Array<{ destination: string; data: unknown }>> {
    if (names.length === 0) return [];
    const unique = Array.from(new Set(names.filter(Boolean)));
    const conditions: SQL[] = unique.flatMap((name) => [
      ilike(destinationGuruTable.destination, name),
      sql`${name} ILIKE '%' || ${destinationGuruTable.destination} || '%'`,
    ]);
    return db
      .select({ destination: destinationGuruTable.destination, data: destinationGuruTable.data })
      .from(destinationGuruTable)
      .where(or(...conditions));
  },

  async findAllDestinations() {
    return db
      .select({ destination: destinationGuruTable.destination, country: destinationGuruTable.country, id: destinationGuruTable.id })
      .from(destinationGuruTable)
      .orderBy(destinationGuruTable.destination);
  },

  async findDestinationByName(name: string) {
    const [row] = await db
      .select()
      .from(destinationGuruTable)
      .where(or(
        ilike(destinationGuruTable.destination, name),
        sql`${name} ILIKE '%' || ${destinationGuruTable.destination} || '%'`,
      ))
      .limit(1);
    return row ?? null;
  },

  async getStats() {
    const [[dealCount], [destCount]] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(quote)
        .where(and(eq(quote.is_active, true), eq(quote.isFreeQuote, true))),
      db.select({ count: sql<number>`count(*)::int` }).from(destinationGuruTable),
    ]);
    return { totalDeals: dealCount?.count || 0, totalDestinations: destCount?.count || 0 };
  },

  async fetchIncludesByQuoteIds(quoteIds: string[]): Promise<Record<string, string[]>> {
    if (quoteIds.length === 0) return {};

    const [flightRows, accomRows] = await Promise.all([
      db
        .select({ quoteId: quote_flights.quote_id })
        .from(quote_flights)
        .where(and(
          sql`${quote_flights.quote_id} = ANY(${quoteIds})`,
          eq(quote_flights.is_included_in_package, true),
        )),
      db
        .select({
          quoteId: quote_accomodation.quote_id,
          nights: quote_accomodation.no_of_nights,
          boardBasisType: board_basis.type,
        })
        .from(quote_accomodation)
        .leftJoin(board_basis, eq(board_basis.id, quote_accomodation.board_basis_id))
        .where(and(
          sql`${quote_accomodation.quote_id} = ANY(${quoteIds})`,
          eq(quote_accomodation.is_included_in_package, true),
        )),
    ]);

    const quotesWithFlights = new Set(
      flightRows.map((f) => f.quoteId).filter((id): id is string => !!id),
    );

    const map: Record<string, string[]> = {};
    for (const id of quoteIds) {
      const list: string[] = [];
      if (quotesWithFlights.has(id)) list.push("Return Flights");
      for (const a of accomRows.filter((a) => a.quoteId === id)) {
        if (a.nights && a.nights > 0) list.push(`${a.nights} Night${a.nights !== 1 ? "s" : ""} Hotel`);
        if (a.boardBasisType) list.push(a.boardBasisType);
      }
      map[id] = list;
    }
    return map;
  },
};

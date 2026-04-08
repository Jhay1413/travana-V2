import { Router, Request, Response } from "express";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../config/database";
import {
  quote, quote_accomodation, quote_flights, quote_cruise,
  accomodation_list, resorts, destination, country,
  quoteImages, accommodation_images, destinationGuruTable,
  package_type, airport, board_basis, cottages, lodges, park,
} from "@shared/schema";
import { eq, and, desc, asc, isNotNull, inArray, or, ilike, sql } from "drizzle-orm";

const websitePublicRouter = Router();

websitePublicRouter.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (_req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ─── Aliases ────────────────────────────────────────────────────────────────

const departAirport = alias(airport, "depart_airport");

// ─── Base conditions ─────────────────────────────────────────────────────────

function baseConditions() {
  return [
    eq(quote.is_active, true),
    isNotNull(quote.quote_token),
    eq(quote.show_on_portal, true),
    eq(quote.isFreeQuote, true),
  ];
}

// ─── Select fields ───────────────────────────────────────────────────────────

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
    category: package_type.name,
    // package_holiday destination chain
    destinationName: destination.name,
    countryName: country.country_name,
    // hot_tub_break destination (lodge → park or cottage)
    parkCity: park.city,
    parkLocation: park.location,
    cottageLocation: cottages.location,
    // cruise destination
    cruiseName: quote_cruise.cruise_name,
  };
}

// ─── Joins (applied to every deal query) ─────────────────────────────────────

function applyDealJoins(q: any) {
  return q
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

// ─── Destination resolution per quote type ───────────────────────────────────

function resolveDestination(r: any): { destination: string | null; country: string | null } {
  if (r.quoteType === "hot_tub_break") {
    return {
      destination: r.parkCity || r.parkLocation || r.cottageLocation || null,
      country: "United Kingdom",
    };
  }
  if (r.quoteType === "cruise") {
    return { destination: r.cruiseName || null, country: null };
  }
  return { destination: r.destinationName || null, country: r.countryName || null };
}

// ─── Bulk data fetchers ───────────────────────────────────────────────────────

async function fetchQuoteImages(quoteIds: string[]): Promise<Record<string, string[]>> {
  if (quoteIds.length === 0) return {};

  const images = await db
    .select({ quoteId: quoteImages.quoteId, url: quoteImages.url, isPrimary: quoteImages.isPrimary })
    .from(quoteImages)
    .where(inArray(quoteImages.quoteId, quoteIds));

  const imageMap: Record<string, string[]> = {};
  const primaryMap: Record<string, string> = {};

  for (const img of images) {
    if (img.quoteId) {
      if (!imageMap[img.quoteId]) imageMap[img.quoteId] = [];
      if (img.url) imageMap[img.quoteId].push(img.url);
      if (img.isPrimary && img.url) primaryMap[img.quoteId] = img.url;
    }
  }

  // Fall back to accommodation images for quotes with no direct images
  const missingIds = quoteIds.filter((id) => !imageMap[id] || imageMap[id].length === 0);
  if (missingIds.length > 0) {
    const accomImages = await db
      .select({ quoteId: quote_accomodation.quote_id, url: accommodation_images.image_url })
      .from(quote_accomodation)
      .innerJoin(
        accommodation_images,
        eq(accommodation_images.accommodation_id, quote_accomodation.accomodation_id),
      )
      .where(
        and(
          inArray(quote_accomodation.quote_id, missingIds),
          eq(quote_accomodation.is_primary, true),
        ),
      );

    for (const img of accomImages) {
      if (img.quoteId) {
        if (!imageMap[img.quoteId]) imageMap[img.quoteId] = [];
        imageMap[img.quoteId].push(img.url);
      }
    }
  }

  // Ensure primary image is first
  for (const id of quoteIds) {
    if (primaryMap[id] && imageMap[id]) {
      const idx = imageMap[id].indexOf(primaryMap[id]);
      if (idx > 0) {
        imageMap[id].splice(idx, 1);
        imageMap[id].unshift(primaryMap[id]);
      }
    }
  }

  return imageMap;
}

async function fetchDepartureAirports(quoteIds: string[]): Promise<Record<string, string>> {
  if (quoteIds.length === 0) return {};

  const rows = await db
    .select({
      quoteId: quote_flights.quote_id,
      airportName: departAirport.airport_name,
      legOrder: quote_flights.leg_order,
    })
    .from(quote_flights)
    .innerJoin(departAirport, eq(departAirport.id, quote_flights.departing_airport_id))
    .where(inArray(quote_flights.quote_id, quoteIds))
    .orderBy(quote_flights.leg_order);

  const map: Record<string, string> = {};
  for (const r of rows) {
    if (r.quoteId && !map[r.quoteId] && r.airportName) {
      map[r.quoteId] = r.airportName;
    }
  }
  return map;
}

async function fetchIncludes(quoteIds: string[]): Promise<Record<string, string[]>> {
  if (quoteIds.length === 0) return {};

  const [flightRows, accomRows] = await Promise.all([
    db
      .select({ quoteId: quote_flights.quote_id })
      .from(quote_flights)
      .where(
        and(
          sql`${quote_flights.quote_id} = ANY(${quoteIds})`,
          eq(quote_flights.is_included_in_package, true),
        ),
      ),
    db
      .select({
        quoteId: quote_accomodation.quote_id,
        nights: quote_accomodation.no_of_nights,
        boardBasisType: board_basis.type,
      })
      .from(quote_accomodation)
      .leftJoin(board_basis, eq(board_basis.id, quote_accomodation.board_basis_id))
      .where(
        and(
          sql`${quote_accomodation.quote_id} = ANY(${quoteIds})`,
          eq(quote_accomodation.is_included_in_package, true),
        ),
      ),
  ]);

  const quotesWithFlights = new Set(
    flightRows.map((f) => f.quoteId).filter((id): id is string => !!id),
  );

  const map: Record<string, string[]> = {};
  for (const id of quoteIds) {
    const list: string[] = [];
    if (quotesWithFlights.has(id)) list.push("Return Flights");

    for (const a of accomRows.filter((a) => a.quoteId === id)) {
      if (a.nights && a.nights > 0) {
        list.push(`${a.nights} Night${a.nights !== 1 ? "s" : ""} Hotel`);
      }
      if (a.boardBasisType) list.push(a.boardBasisType);
    }
    map[id] = list;
  }
  return map;
}

async function fetchGuruData(destNames: (string | null)[]): Promise<Record<string, any>> {
  const unique = Array.from(new Set(destNames.filter((n): n is string => !!n)));
  if (unique.length === 0) return {};

  const allGurus = await db.select().from(destinationGuruTable);

  const map: Record<string, any> = {};
  for (const name of unique) {
    const lower = name.toLowerCase();
    const match = allGurus.find(
      (g) =>
        g.destination.toLowerCase() === lower ||
        lower.includes(g.destination.toLowerCase()),
    );
    if (match) map[name] = match;
  }
  return map;
}

// ─── Deal formatter ───────────────────────────────────────────────────────────

function buildDeal(
  r: any,
  imageMap: Record<string, string[]>,
  airportMap: Record<string, string>,
  includesMap: Record<string, string[]>,
  guruMap: Record<string, any>,
) {
  const { destination: dest, country: ctry } = resolveDestination(r);
  const images = imageMap[r.id] || [];
  const guruData = dest ? (guruMap[dest]?.data as any) : null;

  const returnDate =
    r.travelDate && r.numNights
      ? (() => {
          const d = new Date(r.travelDate);
          d.setDate(d.getDate() + r.numNights);
          return d.toISOString().split("T")[0];
        })()
      : null;

  return {
    id: r.id,
    title: r.title || `${dest || "Holiday"} Getaway`,
    destination: dest,
    country: ctry,
    category: r.category || null,
    description: guruData?.travelInfo?.summary || null,
    shortDescription: guruData?.tagline || null,
    price: parseFloat(r.salesPrice || "0"),
    originalPrice: r.pricePerPerson ? parseFloat(r.pricePerPerson) : null,
    imageUrl: images[0] || null,
    imageUrls: images,
    nights: r.numNights ?? null,
    departureDate: r.travelDate || null,
    returnDate,
    departureAirport: r.quoteType !== "hot_tub_break" ? (airportMap[r.id] || null) : null,
    includes: includesMap[r.id] || [],
    highlights: guruData?.mustDo
      ? (guruData.mustDo as any[]).slice(0, 5).map((m) => m.name)
      : [],
    active: r.isActive ?? true,
    createdAt: r.dateCreated ? new Date(r.dateCreated).toISOString() : null,
  };
}

async function buildDealsResponse(rows: any[]): Promise<any[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [imageMap, airportMap, includesMap] = await Promise.all([
    fetchQuoteImages(ids),
    fetchDepartureAirports(ids),
    fetchIncludes(ids),
  ]);

  const destNames = rows.map((r) => resolveDestination(r).destination);
  const guruMap = await fetchGuruData(destNames);

  return rows.map((r) => buildDeal(r, imageMap, airportMap, includesMap, guruMap));
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /deals
websitePublicRouter.get("/deals", async (req: Request, res: Response) => {
  try {
    const page = Math.max(0, parseInt(req.query.page as string) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const sortBy = (req.query.sort as string) || "newest";
    const category = (req.query.category as string || "").trim();
    const offset = page * limit;

    const validSorts = ["newest", "price_asc", "price_desc"];
    if (!validSorts.includes(sortBy)) {
      return res.status(400).json({ error: "Invalid sort parameter" });
    }

    const conditions = baseConditions();
    if (category) conditions.push(ilike(package_type.name, category));

    const orderClause =
      sortBy === "price_asc" ? [asc(quote.sales_price)] :
      sortBy === "price_desc" ? [desc(quote.sales_price)] :
      [desc(quote.date_created)];

    const baseQ = db.select(selectDealFields()).from(quote);
    const rows = await applyDealJoins(baseQ)
      .where(and(...conditions))
      .orderBy(...orderClause)
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const sliced = rows.slice(0, limit);
    const deals = await buildDealsResponse(sliced);

    res.json({ data: deals, page, hasMore });
  } catch (err: any) {
    console.error("Public deals error:", err);
    res.status(500).json({ error: "Failed to load deals" });
  }
});

// GET /deals/latest  — must be defined before /deals/:id
websitePublicRouter.get("/deals/latest", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 8));

    const baseQ = db.select(selectDealFields()).from(quote);
    const rows = await applyDealJoins(baseQ)
      .where(and(...baseConditions()))
      .orderBy(desc(quote.date_created))
      .limit(limit);

    const deals = await buildDealsResponse(rows);
    res.json({ data: deals });
  } catch (err: any) {
    console.error("Public latest deals error:", err);
    res.status(500).json({ error: "Failed to load latest deals" });
  }
});

// GET /deals/categories  — must be defined before /deals/:id
websitePublicRouter.get("/deals/categories", async (_req: Request, res: Response) => {
  try {
    const catRows = await db
      .select({
        category: package_type.name,
        count: sql<number>`count(${quote.id})::int`,
        minPrice: sql<string>`min(${quote.sales_price}::numeric)`,
      })
      .from(quote)
      .leftJoin(package_type, eq(package_type.id, quote.holiday_type_id))
      .where(and(...baseConditions(), isNotNull(package_type.name)))
      .groupBy(package_type.name)
      .orderBy(package_type.name);

    if (catRows.length === 0) return res.json({ data: [] });

    // One representative quote per category (cheapest) for the image
    const repResult = await db.execute<{ id: string; category: string }>(sql`
      SELECT DISTINCT ON (pt.name) q.id, pt.name AS category
      FROM quote_table q
      LEFT JOIN package_type_table pt ON pt.id = q.holiday_type_id
      WHERE q.is_active = true
        AND q.quote_token IS NOT NULL
        AND q.show_on_portal = true
        AND q."isFreeQuote" = true
        AND pt.name IS NOT NULL
      ORDER BY pt.name, q.sales_price::numeric ASC
    `);

    const repIds = repResult.rows.map((r) => r.id);
    const imageMap = await fetchQuoteImages(repIds);
    const imageByCategory: Record<string, string | null> = Object.fromEntries(
      repResult.rows.map((r) => [r.category, (imageMap[r.id] || [])[0] || null]),
    );

    const data = catRows.map((cat) => ({
      category: cat.category,
      count: cat.count,
      minPrice: parseFloat(cat.minPrice || "0"),
      imageUrl: imageByCategory[cat.category!] || null,
    }));

    res.json({ data });
  } catch (err: any) {
    console.error("Public categories error:", err);
    res.status(500).json({ error: "Failed to load categories" });
  }
});

// GET /deals/:id
websitePublicRouter.get("/deals/:id", async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;

    const baseQ = db.select(selectDealFields()).from(quote);
    const [row] = await applyDealJoins(baseQ)
      .where(and(eq(quote.id, id), ...baseConditions()))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Deal not found" });

    const [deal] = await buildDealsResponse([row]);
    res.json({ data: deal });
  } catch (err: any) {
    console.error("Public deal detail error:", err);
    res.status(500).json({ error: "Failed to load deal" });
  }
});

// ─── Existing endpoints (unchanged) ──────────────────────────────────────────

websitePublicRouter.get("/destinations", async (_req: Request, res: Response) => {
  try {
    const destinations = await db
      .select({
        destination: destinationGuruTable.destination,
        country: destinationGuruTable.country,
        id: destinationGuruTable.id,
      })
      .from(destinationGuruTable)
      .orderBy(destinationGuruTable.destination);

    res.json({ success: true, data: destinations });
  } catch (err: any) {
    console.error("Public destinations error:", err);
    res.status(500).json({ success: false, error: "Failed to load destinations" });
  }
});

websitePublicRouter.get("/destinations/:name", async (req: Request<{ name: string }>, res: Response) => {
  try {
    const name = decodeURIComponent(req.params.name);

    const [guru] = await db
      .select()
      .from(destinationGuruTable)
      .where(
        or(
          ilike(destinationGuruTable.destination, name),
          sql`${name} ILIKE '%' || ${destinationGuruTable.destination} || '%'`,
        ),
      )
      .limit(1);

    if (!guru) return res.status(404).json({ success: false, error: "Destination not found" });

    const dealsQ = db.select(selectDealFields()).from(quote);
    const dealsRows = await applyDealJoins(dealsQ)
      .where(
        and(
          ...baseConditions(),
          ilike(destination.name, guru.destination),
        ),
      )
      .orderBy(desc(quote.date_created))
      .limit(20);

    const deals = await buildDealsResponse(dealsRows);

    res.json({
      success: true,
      data: {
        destination: guru.destination,
        country: guru.country,
        guru: guru.data,
        deals,
      },
    });
  } catch (err: any) {
    console.error("Public destination detail error:", err);
    res.status(500).json({ success: false, error: "Failed to load destination" });
  }
});

websitePublicRouter.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [dealCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(quote)
      .where(and(...baseConditions()));

    const [destCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(destinationGuruTable);

    res.json({
      success: true,
      data: {
        totalDeals: dealCount?.count || 0,
        totalDestinations: destCount?.count || 0,
      },
    });
  } catch (err: any) {
    console.error("Public stats error:", err);
    res.status(500).json({ success: false, error: "Failed to load stats" });
  }
});

export default websitePublicRouter;

import { Router, Request, Response } from "express";
import { db } from "../config/database";
import {
  quote, quote_accomodation, accomodation_list, resorts, destination, country,
  quoteImages, accommodation_images, destinationGuruTable,
} from "@shared/schema";
import { eq, and, desc, isNotNull, inArray, or, ilike, sql, SQL } from "drizzle-orm";

const websitePublicRouter = Router();

websitePublicRouter.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (_req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

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
      imageMap[img.quoteId].push(img.url);
      if (img.isPrimary) primaryMap[img.quoteId] = img.url;
    }
  }

  const missingImageIds = quoteIds.filter((id) => !imageMap[id] || imageMap[id].length === 0);
  if (missingImageIds.length > 0) {
    const accomImages = await db
      .select({
        quoteId: quote_accomodation.quote_id,
        url: accommodation_images.image_url,
      })
      .from(quote_accomodation)
      .innerJoin(accommodation_images, eq(accommodation_images.accommodation_id, quote_accomodation.accomodation_id))
      .where(and(
        inArray(quote_accomodation.quote_id, missingImageIds),
        eq(quote_accomodation.is_primary, true)
      ));

    for (const img of accomImages) {
      if (img.quoteId) {
        if (!imageMap[img.quoteId]) imageMap[img.quoteId] = [];
        imageMap[img.quoteId].push(img.url);
      }
    }
  }

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

websitePublicRouter.get("/deals", async (req: Request, res: Response) => {
  try {
    const page = Math.max(0, parseInt(req.query.page as string) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string || "").trim().toLowerCase();
    const sortBy = (req.query.sort as string) || "newest";
    const offset = page * limit;

    const validSorts = ["newest", "price_asc", "price_desc"];
    if (!validSorts.includes(sortBy)) {
      return res.status(400).json({ success: false, error: "Invalid sort parameter" });
    }

    const conditions: SQL[] = [
      eq(quote.is_active, true),
      isNotNull(quote.quote_token),
      eq(quote.show_on_portal, true),
    ];

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(quote.title, searchPattern),
          ilike(destination.name, searchPattern),
          ilike(country.country_name, searchPattern),
          ilike(accomodation_list.name, searchPattern)
        )!
      );
    }

    const orderClause = sortBy === "price_asc"
      ? [quote.sales_price]
      : sortBy === "price_desc"
        ? [desc(quote.sales_price)]
        : [desc(quote.date_created)];

    const results = await db
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
        dateCreated: quote.date_created,
      })
      .from(quote)
      .leftJoin(quote_accomodation, and(eq(quote_accomodation.quote_id, quote.id), eq(quote_accomodation.is_primary, true)))
      .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .leftJoin(country, eq(destination.country_id, country.id))
      .where(and(...conditions))
      .orderBy(...orderClause)
      .limit(limit + 1)
      .offset(offset);

    const hasMore = results.length > limit;
    const sliced = results.slice(0, limit);

    const quoteIds = sliced.map((r) => r.id);
    const imageMap = await fetchQuoteImages(quoteIds);

    const deals = sliced.map((r) => formatDeal(r, imageMap));

    res.json({ success: true, data: { deals, page, hasMore } });
  } catch (err: any) {
    console.error("Public website deals error:", err);
    res.status(500).json({ success: false, error: "Failed to load deals" });
  }
});

function formatDeal(r: any, imageMap: Record<string, string[]>) {
  return {
    id: r.id,
    token: r.token,
    title: r.title || `${r.destinationName || r.countryName || "Holiday"} Getaway`,
    destination: r.destinationName && r.countryName ? `${r.destinationName}, ${r.countryName}` : r.countryName || r.destinationName || "TBC",
    destination_name: r.destinationName || "",
    country: r.countryName || "",
    hotel: r.accommodationName || "",
    price: parseFloat(r.salesPrice || "0"),
    travel_date: r.travelDate,
    num_nights: r.numNights,
    images: imageMap[r.id] || [],
    image_url: (imageMap[r.id] || [])[0] || "",
    quote_url: r.token ? `/view-quote/${r.token}` : null,
  };
}

websitePublicRouter.get("/deals/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const [result] = await db
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
        dateCreated: quote.date_created,
      })
      .from(quote)
      .leftJoin(quote_accomodation, and(eq(quote_accomodation.quote_id, quote.id), eq(quote_accomodation.is_primary, true)))
      .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .leftJoin(country, eq(destination.country_id, country.id))
      .where(and(eq(quote.is_active, true), eq(quote.quote_token, token), eq(quote.show_on_portal, true)))
      .limit(1);

    if (!result) return res.status(404).json({ success: false, error: "Deal not found" });

    const imageMap = await fetchQuoteImages([result.id]);
    const deal = formatDeal(result, imageMap);

    let guruData = null;
    if (result.destinationName) {
      const [guru] = await db
        .select()
        .from(destinationGuruTable)
        .where(
          or(
            ilike(destinationGuruTable.destination, result.destinationName),
            sql`${result.destinationName} ILIKE '%' || ${destinationGuruTable.destination} || '%'`
          )
        )
        .limit(1);
      if (guru) {
        guruData = {
          destination: guru.destination,
          country: guru.country,
          data: guru.data,
        };
      }
    }

    res.json({ success: true, data: { ...deal, guru: guruData } });
  } catch (err: any) {
    console.error("Public website deal detail error:", err);
    res.status(500).json({ success: false, error: "Failed to load deal" });
  }
});

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
    console.error("Public website destinations error:", err);
    res.status(500).json({ success: false, error: "Failed to load destinations" });
  }
});

websitePublicRouter.get("/destinations/:name", async (req: Request, res: Response) => {
  try {
    const name = decodeURIComponent(req.params.name);

    const [guru] = await db
      .select()
      .from(destinationGuruTable)
      .where(
        or(
          ilike(destinationGuruTable.destination, name),
          sql`${name} ILIKE '%' || ${destinationGuruTable.destination} || '%'`
        )
      )
      .limit(1);

    if (!guru) return res.status(404).json({ success: false, error: "Destination not found" });

    const dealsForDest = await db
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
        dateCreated: quote.date_created,
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
        eq(quote.show_on_portal, true),
        ilike(destination.name, guru.destination)
      ))
      .orderBy(desc(quote.date_created))
      .limit(20);

    const quoteIds = dealsForDest.map((r) => r.id);
    const imageMap = await fetchQuoteImages(quoteIds);
    const deals = dealsForDest.map((r) => formatDeal(r, imageMap));

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
    console.error("Public website destination detail error:", err);
    res.status(500).json({ success: false, error: "Failed to load destination" });
  }
});

websitePublicRouter.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [dealCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(quote)
      .where(and(eq(quote.is_active, true), isNotNull(quote.quote_token), eq(quote.show_on_portal, true)));

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
    console.error("Public website stats error:", err);
    res.status(500).json({ success: false, error: "Failed to load stats" });
  }
});

export default websitePublicRouter;

import { Router, Request, Response } from "express";
import { db } from "../config/database";
import { quote, quote_accomodation, accomodation_list, resorts, destination, country, quoteImages, accommodation_images } from "@shared/schema";
import { eq, and, desc, isNotNull, inArray, sql } from "drizzle-orm";

const portalRouter = Router();

portalRouter.get("/deals", async (_req: Request, res: Response) => {
  try {
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
      })
      .from(quote)
      .leftJoin(quote_accomodation, and(eq(quote_accomodation.quote_id, quote.id), eq(quote_accomodation.is_primary, true)))
      .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .leftJoin(country, eq(destination.country_id, country.id))
      .where(and(eq(quote.isFreeQuote, true), eq(quote.is_active, true), isNotNull(quote.quote_token)))
      .orderBy(desc(quote.date_created))
      .limit(20);

    const quoteIds = results.map((r) => r.id);
    let imageMap: Record<string, string> = {};
    if (quoteIds.length > 0) {
      const images = await db
        .select({ quoteId: quoteImages.quoteId, url: quoteImages.url, isPrimary: quoteImages.isPrimary })
        .from(quoteImages)
        .where(inArray(quoteImages.quoteId, quoteIds));

      for (const img of images) {
        if (img.quoteId) {
          if (!imageMap[img.quoteId] || img.isPrimary) {
            imageMap[img.quoteId] = img.url;
          }
        }
      }

      const missingImageIds = quoteIds.filter((id) => !imageMap[id]);
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
          ))
          .limit(missingImageIds.length);

        for (const img of accomImages) {
          if (img.quoteId && !imageMap[img.quoteId]) {
            imageMap[img.quoteId] = img.url;
          }
        }
      }
    }

    const deals = results.map((r) => ({
      id: r.id,
      token: r.token,
      title: r.title || `${r.destinationName || r.countryName || "Holiday"} Getaway`,
      destination: r.destinationName && r.countryName ? `${r.destinationName}, ${r.countryName}` : r.countryName || r.destinationName || "TBC",
      hotel: r.accommodationName || "",
      price: parseFloat(r.salesPrice || "0"),
      travel_date: r.travelDate,
      num_nights: r.numNights,
      image_url: imageMap[r.id] || "",
      quote_url: r.token ? `/portal/quote/${r.token}` : null,
    }));

    res.json(deals);
  } catch (err: any) {
    console.error("Error fetching portal deals:", err);
    res.status(500).json({ error: "Failed to load deals" });
  }
});

portalRouter.post("/login", (_req: Request, res: Response) => {
  res.json({ token: "demo-portal-token" });
});

portalRouter.get("/user", (_req: Request, res: Response) => {
  res.json({ firstName: "Traveller", lastName: "", email: "" });
});

portalRouter.get("/quotes", (_req: Request, res: Response) => {
  res.json([]);
});

portalRouter.get("/bookings", (_req: Request, res: Response) => {
  res.json([]);
});

portalRouter.get("/messages", (_req: Request, res: Response) => {
  res.json([]);
});

portalRouter.post("/quote-request", (_req: Request, res: Response) => {
  res.json({ success: true });
});

portalRouter.post("/interest", (_req: Request, res: Response) => {
  res.json({ success: true });
});

portalRouter.post("/message", (_req: Request, res: Response) => {
  res.json({ success: true });
});

export default portalRouter;

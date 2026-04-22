import { Router, Request, Response, NextFunction } from "express";
import { db } from "../config/database";
import {
  quote, quote_accomodation, accomodation_list, resorts, destination, country,
  quoteImages, accommodation_images, clientTable, transaction, booking,
  portalMessages, webauthnCredentials, pushSubscriptions, quoteTags, tags, clientTags,
  quoteViewsTable,
} from "@shared/schema";
import { referralService } from "../services/referral.service";
import { referralPayoutService } from "../services/referralPayout.service";
import { referralWithdrawalService } from "../services/referralWithdrawal.service";
import { eq, and, desc, isNotNull, inArray, sql, asc, ilike, exists } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { getUserId } from "../utils/get-user-id";
import { quotePublicRepository } from "../repositories/quote-public.repository";
import { bridgePortalMessageToChat } from "../services/portal-chat-bridge";
import { pushNotificationService } from "../services/push-notification.service";
import { tagService } from "../services/tag.service";

const portalRouter = Router();

const JWT_SECRET = (() => {
  const dbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || "";
  return crypto.createHash("sha256").update("portal-jwt-" + dbUrl).digest("hex").slice(0, 64);
})();

interface PortalTokenPayload {
  clientId: string;
  email: string;
}

function signPortalToken(payload: PortalTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

function verifyPortalToken(token: string): PortalTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as PortalTokenPayload;
  } catch {
    return null;
  }
}

function portalAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const payload = verifyPortalToken(auth.slice(7));
  if (!payload) {
    return res.status(401).json({ error: "Invalid token" });
  }
  (req as any).portalClient = payload;
  next();
}

portalRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, pin } = req.body;
    if (!email || !pin) {
      return res.status(400).json({ error: "Email and PIN are required" });
    }

    const [client] = await db
      .select({ id: clientTable.id, email: clientTable.email, firstName: clientTable.firstName, portalPin: clientTable.portalPin })
      .from(clientTable)
      .where(eq(clientTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (!client) {
      return res.status(401).json({ error: "No account found with that email" });
    }
    if (!client.portalPin) {
      return res.status(401).json({ error: "Portal access not set up. Please contact your travel agent." });
    }

    const valid = await bcrypt.compare(pin, client.portalPin);
    if (!valid) {
      return res.status(401).json({ error: "Incorrect PIN" });
    }

    const token = signPortalToken({ clientId: client.id, email: client.email || "" });

    const creds = await db
      .select({ id: webauthnCredentials.id })
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.clientId, client.id))
      .limit(1);

    res.json({
      token,
      clientId: client.id,
      firstName: client.firstName,
      hasBiometric: creds.length > 0,
    });
  } catch (err: any) {
    console.error("Portal login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

function requireStaffAuth(req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Staff authentication required" });
  }
  next();
}


portalRouter.post("/webauthn/register", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { credentialId, publicKey, deviceName } = req.body;
    if (!credentialId || !publicKey) {
      return res.status(400).json({ error: "Missing credential data" });
    }

    await db.insert(webauthnCredentials).values({
      clientId,
      credentialId,
      publicKey,
      deviceName: deviceName || "Unknown device",
      counter: 0,
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error("WebAuthn register error:", err);
    res.status(500).json({ error: "Failed to register biometric" });
  }
});

portalRouter.post("/webauthn/login", async (req: Request, res: Response) => {
  try {
    const { credentialId, clientId } = req.body;
    if (!credentialId || !clientId) {
      return res.status(400).json({ error: "Missing credential data" });
    }

    const [cred] = await db
      .select()
      .from(webauthnCredentials)
      .where(and(
        eq(webauthnCredentials.clientId, clientId),
        eq(webauthnCredentials.credentialId, credentialId),
      ))
      .limit(1);

    if (!cred) {
      return res.status(401).json({ error: "Biometric not recognized" });
    }

    const [client] = await db
      .select({ id: clientTable.id, email: clientTable.email, firstName: clientTable.firstName })
      .from(clientTable)
      .where(eq(clientTable.id, clientId))
      .limit(1);

    if (!client) {
      return res.status(401).json({ error: "Client not found" });
    }

    await db
      .update(webauthnCredentials)
      .set({ counter: sql`${webauthnCredentials.counter} + 1` })
      .where(eq(webauthnCredentials.id, cred.id));

    const token = signPortalToken({ clientId: client.id, email: client.email || "" });
    res.json({ token, clientId: client.id, firstName: client.firstName });
  } catch (err: any) {
    console.error("WebAuthn login error:", err);
    res.status(500).json({ error: "Biometric login failed" });
  }
});

portalRouter.post("/webauthn/check", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.body;
    if (!clientId) return res.json({ hasBiometric: false });

    const creds = await db
      .select({ id: webauthnCredentials.id, deviceName: webauthnCredentials.deviceName })
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.clientId, clientId));

    res.json({ hasBiometric: creds.length > 0, devices: creds });
  } catch {
    res.json({ hasBiometric: false });
  }
});

// Returns available countries and most-popular tags for the deals filter UI
portalRouter.get("/deals/filters", async (_req: Request, res: Response) => {
  try {
    const baseWhere = and(
      eq(quote.is_active, true),
      isNotNull(quote.quote_token),
      eq(quote.show_on_portal, true),
      eq(quote.isFreeQuote, true),
    );

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
        .where(and(
          eq(quote.is_active, true),
          isNotNull(quote.quote_token),
          eq(quote.show_on_portal, true),
          eq(quote.isFreeQuote, true),
        ))
        .groupBy(tags.name)
        .orderBy(desc(sql`count(${quoteTags.quoteId})`))
        .limit(10),
    ]);

    res.json({
      countries: countryRows.map((r) => r.country).filter(Boolean),
      popularTags: tagRows.map((r) => ({ tag: r.tag, count: r.count })),
    });
  } catch (err: any) {
    console.error("Error fetching deal filters:", err);
    res.status(500).json({ error: "Failed to load filters" });
  }
});

portalRouter.get("/deals/for-you", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;

    // Get this client's saved tag IDs
    const clientTagRows = await db
      .select({ tagId: clientTags.tagId })
      .from(clientTags)
      .where(eq(clientTags.clientId, clientId));

    if (clientTagRows.length === 0) return res.json([]);

    const clientTagIds = clientTagRows.map((r) => r.tagId);

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
      .where(and(
        eq(quote.is_active, true),
        isNotNull(quote.quote_token),
        eq(quote.isFreeQuote, true),
        exists(
          db.select({ one: sql`1` })
            .from(quoteTags)
            .where(and(eq(quoteTags.quoteId, quote.id), inArray(quoteTags.tagId, clientTagIds)))
        ),
      ))
      .orderBy(desc(quote.date_created))
      .limit(20);

    const quoteIds = results.map((r) => r.id);

    let tagMap: Record<string, string[]> = {};
    if (quoteIds.length > 0) {
      const tagRows = await db
        .select({ quoteId: quoteTags.quoteId, tagName: tags.name })
        .from(quoteTags)
        .innerJoin(tags, eq(quoteTags.tagId, tags.id))
        .where(inArray(quoteTags.quoteId, quoteIds));
      for (const row of tagRows) {
        if (!tagMap[row.quoteId]) tagMap[row.quoteId] = [];
        tagMap[row.quoteId].push(row.tagName);
      }
    }

    let imageMap: Record<string, string> = {};
    if (quoteIds.length > 0) {
      const images = await db
        .select({ quoteId: quoteImages.quoteId, url: quoteImages.url, isPrimary: quoteImages.isPrimary })
        .from(quoteImages)
        .where(inArray(quoteImages.quoteId, quoteIds));
      for (const img of images) {
        if (img.quoteId && (!imageMap[img.quoteId] || img.isPrimary)) {
          imageMap[img.quoteId] = img.url;
        }
      }
      const missingImageIds = quoteIds.filter((id) => !imageMap[id]);
      if (missingImageIds.length > 0) {
        const accomImages = await db
          .select({ quoteId: quote_accomodation.quote_id, url: accommodation_images.image_url })
          .from(quote_accomodation)
          .innerJoin(accommodation_images, eq(accommodation_images.accommodation_id, quote_accomodation.accomodation_id))
          .where(and(inArray(quote_accomodation.quote_id, missingImageIds), eq(quote_accomodation.is_primary, true)))
          .limit(missingImageIds.length);
        for (const img of accomImages) {
          if (img.quoteId && !imageMap[img.quoteId]) imageMap[img.quoteId] = img.url;
        }
      }
    }

    res.json(results.map((r) => ({
      id: r.id,
      token: r.token,
      title: r.title || `${r.destinationName || r.countryName || "Holiday"} Getaway`,
      destination: r.destinationName && r.countryName ? `${r.destinationName}, ${r.countryName}` : r.countryName || r.destinationName || "TBC",
      country: r.countryName || null,
      hotel: r.accommodationName || "",
      price: parseFloat(r.salesPrice || "0"),
      travel_date: r.travelDate,
      num_nights: r.numNights,
      image_url: imageMap[r.id] || "",
      quote_url: r.token ? `/portal/quote/${r.token}` : null,
      tags: tagMap[r.id] ?? [],
    })));
  } catch (err: any) {
    console.error("Error fetching for-you deals:", err);
    res.status(500).json({ error: "Failed to load personalised deals" });
  }
});

portalRouter.get("/deals", async (req: Request, res: Response) => {
  try {
    const filterCountry = ((req.query.country as string) || "").trim();
    const filterTag = ((req.query.tag as string) || "").trim();

    const baseConditions = and(
      eq(quote.is_active, true),
      isNotNull(quote.quote_token),
      eq(quote.show_on_portal, true),
      eq(quote.isFreeQuote, true),
      filterCountry ? ilike(country.country_name, filterCountry) : undefined,
      filterTag
        ? exists(
            db
              .select({ one: sql`1` })
              .from(quoteTags)
              .innerJoin(tags, eq(tags.id, quoteTags.tagId))
              .where(and(eq(quoteTags.quoteId, quote.id), ilike(tags.name, filterTag)))
          )
        : undefined,
    );

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
      .where(baseConditions)
      .orderBy(desc(quote.date_created))
      .limit(50);

    const quoteIds = results.map((r) => r.id);

    // Fetch tags for each deal
    let tagMap: Record<string, string[]> = {};
    if (quoteIds.length > 0) {
      const tagRows = await db
        .select({ quoteId: quoteTags.quoteId, tagName: tags.name })
        .from(quoteTags)
        .innerJoin(tags, eq(quoteTags.tagId, tags.id))
        .where(inArray(quoteTags.quoteId, quoteIds));
      for (const row of tagRows) {
        if (!tagMap[row.quoteId]) tagMap[row.quoteId] = [];
        tagMap[row.quoteId].push(row.tagName);
      }
    }

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
      country: r.countryName || null,
      hotel: r.accommodationName || "",
      price: parseFloat(r.salesPrice || "0"),
      travel_date: r.travelDate,
      num_nights: r.numNights,
      image_url: imageMap[r.id] || "",
      quote_url: r.token ? `/portal/quote/${r.token}` : null,
      tags: tagMap[r.id] ?? [],
    }));

    res.json(deals);
  } catch (err: any) {
    console.error("Error fetching portal deals:", err);
    res.status(500).json({ error: "Failed to load deals" });
  }
});

portalRouter.get("/user", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const [client] = await db
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

    if (!client) return res.status(404).json({ error: "Client not found" });
    res.json(client);
  } catch (err: any) {
    console.error("Portal user error:", err);
    res.status(500).json({ error: "Failed to load user" });
  }
});

portalRouter.get("/quotes", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;

    const results = await db
      .select({
        quoteId: quote.id,
        title: quote.title,
        salesPrice: quote.sales_price,
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
      .where(and(
        eq(transaction.client_id, clientId),
        eq(quote.is_active, true),
      ))
      .orderBy(desc(quote.date_created));

    const quoteIds = results.map(r => r.quoteId);
    let imageMap: Record<string, string> = {};
    if (quoteIds.length > 0) {
      const images = await db
        .select({ quoteId: quoteImages.quoteId, url: quoteImages.url, isPrimary: quoteImages.isPrimary })
        .from(quoteImages)
        .where(inArray(quoteImages.quoteId, quoteIds));
      for (const img of images) {
        if (img.quoteId && (!imageMap[img.quoteId] || img.isPrimary)) {
          imageMap[img.quoteId] = img.url;
        }
      }
    }

    const mapped = await Promise.all(results.map(async (r) => {
      const dest = r.destinationName && r.countryName
        ? `${r.destinationName}, ${r.countryName}`
        : r.countryName || r.destinationName || "TBC";
      const travelDate = r.travelDate;
      const nights = r.numNights || 7;
      const travelMs = new Date(travelDate).getTime();
      const returnDate = new Date(travelMs + nights * 86400000).toISOString().split("T")[0];

      let token = r.quoteToken;
      if (!token) {
        token = await quotePublicRepository.setToken(r.quoteId);
      }

      return {
        id: r.quoteId,
        title: r.title || `${dest} Getaway`,
        destination: dest,
        hotel: r.accommodationName || "",
        price: parseFloat(r.salesPrice || "0"),
        travel_date: travelDate,
        return_date: returnDate,
        expiry_date: r.dateExpiry ? new Date(r.dateExpiry).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString(),
        image_url: imageMap[r.quoteId] || "",
        quote_url: `/portal/quote/${token}`,
      };
    }));

    res.json(mapped);
  } catch (err: any) {
    console.error("Portal quotes error:", err);
    res.status(500).json({ error: "Failed to load quotes" });
  }
});

portalRouter.get("/bookings", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;

    const results = await db
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
        ) AND ${quote_accomodation.is_primary} = true`
      )
      .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .leftJoin(country, eq(destination.country_id, country.id))
      .where(and(
        eq(transaction.client_id, clientId),
        eq(booking.is_active, true),
      ))
      .orderBy(desc(booking.travel_date));

    const mapped = results.map(r => {
      const dest = r.destinationName && r.countryName
        ? `${r.destinationName}, ${r.countryName}`
        : r.countryName || r.destinationName || "TBC";
      const nights = r.numNights || 7;
      const travelMs = new Date(r.travelDate).getTime();
      const returnDate = new Date(travelMs + nights * 86400000).toISOString().split("T")[0];

      return {
        id: r.bookingId,
        destination: dest,
        hotel: r.accommodationName || r.title || "",
        travel_date: r.travelDate,
        return_date: returnDate,
        booking_reference: r.haysRef || r.supplierRef || "",
        image_url: "",
        documents_url: "#",
      };
    });

    res.json(mapped);
  } catch (err: any) {
    console.error("Portal bookings error:", err);
    res.status(500).json({ error: "Failed to load bookings" });
  }
});

portalRouter.get("/messages", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;

    const msgs = await db
      .select()
      .from(portalMessages)
      .where(eq(portalMessages.clientId, clientId))
      .orderBy(asc(portalMessages.createdAt))
      .limit(100);

    const mapped = msgs.map(m => ({
      id: m.id,
      sender: m.sender as "agent" | "client",
      agent_name: m.agentName || undefined,
      text: m.text,
      timestamp: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
    }));

    res.json(mapped);
  } catch (err: any) {
    console.error("Portal messages error:", err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

portalRouter.post("/message", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Message text required" });

    const trimmed = text.trim();
    await db.insert(portalMessages).values({
      clientId,
      sender: "client",
      text: trimmed,
    });

    await bridgePortalMessageToChat(clientId, trimmed, false);

    res.json({ success: true });
  } catch (err: any) {
    console.error("Portal send message error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

portalRouter.post("/quote-request", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { destination, dates, travellers, notes } = req.body;

    const messageText = `📋 Quote Request:\n• Destination: ${destination || "Not specified"}\n• Dates: ${dates || "Flexible"}\n• Travellers: ${travellers || "Not specified"}\n• Notes: ${notes || "None"}`;
    await db.insert(portalMessages).values({
      clientId,
      sender: "client",
      text: messageText,
    });

    await bridgePortalMessageToChat(clientId, messageText, false);

    res.json({ success: true });
  } catch (err: any) {
    console.error("Quote request error:", err);
    res.status(500).json({ error: "Failed to submit quote request" });
  }
});

portalRouter.post("/interest", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { dealId } = req.body;

    const messageText = `❤️ Interested in deal: ${dealId}`;
    await db.insert(portalMessages).values({
      clientId,
      sender: "client",
      text: messageText,
    });

    await bridgePortalMessageToChat(clientId, messageText, true);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to record interest" });
  }
});

portalRouter.get("/tags", async (_req: Request, res: Response) => {
  try {
    const allTags = await tagService.getAllTags();
    res.json(allTags);
  } catch (err: any) {
    console.error("Portal tags error:", err);
    res.status(500).json({ error: "Failed to load tags" });
  }
});

portalRouter.get("/has-tags", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const hasTags = await tagService.clientHasTags(clientId);
    res.json({ hasTags });
  } catch (err: any) {
    console.error("Portal has-tags error:", err);
    res.status(500).json({ error: "Failed to check tags" });
  }
});

portalRouter.get("/my-tags", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const myTags = await tagService.getClientTags(clientId);
    res.json(myTags);
  } catch (err: any) {
    console.error("Portal my-tags error:", err);
    res.status(500).json({ error: "Failed to load your tags" });
  }
});

portalRouter.post("/my-tags", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { tagIds } = req.body;
    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      return res.status(400).json({ error: "At least one tag is required" });
    }
    await tagService.setClientTags(clientId, tagIds);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Portal set tags error:", err);
    res.status(500).json({ error: "Failed to save tags" });
  }
});

portalRouter.get("/push/vapid-key", (req: Request, res: Response) => {
  res.json({ publicKey: pushNotificationService.getPublicKey() });
});

portalRouter.post("/push/subscribe", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: "Invalid subscription" });
    }
    await pushNotificationService.subscribe(clientId, subscription);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Push subscribe error:", err);
    res.status(500).json({ error: "Failed to subscribe" });
  }
});

portalRouter.post("/push/unsubscribe", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: "Endpoint required" });
    await pushNotificationService.unsubscribe(clientId, endpoint);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to unsubscribe" });
  }
});

// ── VIP Referral Portal Endpoints ──────────────────────────────────────────

portalRouter.get("/vip", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const [client] = await db
      .select({
        vipTier: clientTable.vipTier,
        vipEnrolledAt: clientTable.vipEnrolledAt,
        totalReferrals: clientTable.totalReferrals,
      })
      .from(clientTable)
      .where(eq(clientTable.id, clientId))
      .limit(1);

    if (!client) return res.status(404).json({ error: "Client not found" });

    const totalEarnings = await referralWithdrawalService.getTotalPaidByClient(clientId);

    res.json({
      vipTier: client.vipTier ?? "not_enrolled",
      vipEnrolledAt: client.vipEnrolledAt,
      totalReferrals: client.totalReferrals,
      totalEarnings: totalEarnings.toFixed(2),
    });
  } catch (err: any) {
    console.error("Portal VIP status error:", err);
    res.status(500).json({ error: "Failed to load VIP status" });
  }
});

portalRouter.get("/vip/referrals", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const referrals = await referralService.getReferralsByReferrer(clientId);
    res.json(referrals);
  } catch (err: any) {
    console.error("Portal VIP referrals error:", err);
    res.status(500).json({ error: "Failed to load referrals" });
  }
});

// Returns client's referral_payout records (payout request history)
portalRouter.get("/vip/payout-requests", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const payouts = await referralPayoutService.getPayoutsByClient(clientId);
    res.json(payouts);
  } catch (err: any) {
    console.error("Portal VIP payout requests error:", err);
    res.status(500).json({ error: "Failed to load payout requests" });
  }
});

// Returns client's referral_withdrawal records
portalRouter.get("/vip/withdrawals", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const withdrawals = await referralWithdrawalService.getWithdrawalsByClient(clientId);
    res.json(withdrawals);
  } catch (err: any) {
    console.error("Portal VIP withdrawals error:", err);
    res.status(500).json({ error: "Failed to load withdrawals" });
  }
});

// Client requests payout for all eligible (PENDING + isDue) referrals
// Creates referral_payout records (status: requested) for admin to approve
portalRouter.post("/wallet/request-payout", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const result = await referralPayoutService.requestPayouts(clientId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    const status = err?.statusCode ?? 500;
    res.status(status).json({ error: err.message ?? "Failed to submit payout request." });
  }
});

// Client requests withdrawal of their IN_WALLET balance
// Creates a referral_withdrawal record with bank details or booking credit selection
portalRouter.post("/wallet/withdraw", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const {
      method,
      account_name,
      account_number,
      sort_code,
      booking_id,
    } = req.body;

    if (!method || !["bank_transfer", "booking_credit"].includes(method)) {
      return res.status(400).json({ error: "Invalid method. Must be bank_transfer or booking_credit." });
    }

    const referrals = await referralService.getReferralsByReferrer(clientId);
    const eligible = referrals.filter((r: any) => r.referralStatus === "IN_WALLET");

    if (eligible.length === 0) {
      return res.status(400).json({ error: "No balance in wallet to withdraw." });
    }

    const created = [];
    for (const r of eligible) {
      const w = await referralWithdrawalService.requestWithdrawal({
        referralId: r.id,
        clientId,
        method,
        account_name,
        account_number,
        sort_code,
        booking_id,
      });
      created.push(w);
    }

    const totalAmount = eligible.reduce(
      (sum: number, r: any) => sum + parseFloat(r.payoutAmount ?? "0"),
      0
    );

    res.json({
      success: true,
      referralCount: created.length,
      totalAmount: totalAmount.toFixed(2),
      method,
    });
  } catch (err: any) {
    console.error("Portal wallet withdraw error:", err);
    const status = err?.statusCode ?? 500;
    res.status(status).json({ error: err.message ?? "Failed to submit withdrawal request." });
  }
});

// ── End VIP Referral Portal Endpoints ──────────────────────────────────────

export const portalStaffRouter = Router();

portalStaffRouter.get("/has-pin/:clientId", requireStaffAuth, async (req: Request, res: Response) => {
  try {
    const [client] = await db
      .select({ portalPin: clientTable.portalPin })
      .from(clientTable)
      .where(eq(clientTable.id, req.params.clientId))
      .limit(1);
    res.json({ hasPin: !!client?.portalPin });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to check PIN" });
  }
});

portalStaffRouter.post("/set-pin", requireStaffAuth, async (req: Request, res: Response) => {
  try {
    const { clientId, pin } = req.body;
    if (!clientId || !pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: "Valid 4-digit PIN required" });
    }

    const hash = await bcrypt.hash(pin, 10);
    await db.update(clientTable).set({ portalPin: hash }).where(eq(clientTable.id, clientId));
    res.json({ success: true });
  } catch (err: any) {
    console.error("Set PIN error:", err);
    res.status(500).json({ error: "Failed to set PIN" });
  }
});

portalStaffRouter.post("/remove-pin", requireStaffAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = req.body;
    if (!clientId) return res.status(400).json({ error: "clientId required" });
    await db.update(clientTable).set({ portalPin: null }).where(eq(clientTable.id, clientId));
    res.json({ success: true });
  } catch (err: any) {
    console.error("Remove PIN error:", err);
    res.status(500).json({ error: "Failed to remove PIN" });
  }
});

portalRouter.post("/quote/:token/view", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { token } = req.params;
    const ua = req.headers["user-agent"] || "";

    const [client] = await db
      .select({ firstName: clientTable.firstName, lastName: clientTable.surename })
      .from(clientTable)
      .where(eq(clientTable.id, clientId))
      .limit(1);

    const viewerName = [client?.firstName, client?.lastName].filter(Boolean).join(" ") || null;

    const quoteId = await quotePublicRepository.findQuoteIdByToken(token);
    if (!quoteId) return res.status(404).json({ error: "Quote not found" });

    let deviceType = "desktop";
    if (/mobile|android|iphone|ipad/i.test(ua)) {
      deviceType = /ipad|tablet/i.test(ua) ? "tablet" : "mobile";
    }
    let browser = "Unknown";
    if (/edg/i.test(ua)) browser = "Edge";
    else if (/chrome/i.test(ua)) browser = "Chrome";
    else if (/firefox/i.test(ua)) browser = "Firefox";
    else if (/safari/i.test(ua)) browser = "Safari";
    else if (/opera|opr/i.test(ua)) browser = "Opera";

    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";

    await quotePublicRepository.logView(quoteId, {
      ipAddress: ip.substring(0, 45),
      deviceType,
      browser,
      userAgent: ua.substring(0, 500),
      viewerName,
    });

    await quotePublicRepository.notifyAgent(
      quoteId,
      "Quote Viewed",
      `${viewerName || "A client"} viewed their quote via the portal`,
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error("Portal view error:", err);
    res.status(500).json({ error: "Failed to log view" });
  }
});

export default portalRouter;

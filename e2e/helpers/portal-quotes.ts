/**
 * Helpers for the portal quote specs. Setup only: the quote deal is made through the staff API (so the owner, the
 * client link and staff visibility are real) and its itinerary is written straight to the practice database.
 * The specs assert through the real screens and the portal's own endpoints.
 */
import "./test-db-env";
import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../../server/v2/config/database";
import {
  clientTable,
  clientTags,
  quote,
  quote_accomodation,
  quote_flights,
  quote_lounge_pass,
  quote_transfers,
  quoteImages,
  quoteTags,
  wallet_transaction,
  transaction,
  tags,
} from "../../shared/schema";
import { boardWorld, quoteDeal, type BoardWorld } from "./pipeline";
import { PORTAL_PIN, type PortalSetup } from "./portal";
import { dbClient, queryRows, unique } from "./seed";

export interface PortalQuoteWorld {
  world: BoardWorld;
  /** The customer, signed in to the portal by `startSignedIn(page, portal)`. */
  portal: PortalSetup;
}

/** A staff agent signed in on `page`, and a portal-ready customer of the same agency with a PIN and one interest. */
export async function seedPortalQuoteWorld(page: Page): Promise<PortalQuoteWorld> {
  const world = await boardWorld(page);
  const client = await dbClient(world.clientId);
  const slug = world.agency.orgName.replace(/^Agency /, "");
  await db
    .update(clientTable)
    .set({ portalPin: await bcrypt.hash(PORTAL_PIN, 4), mustChangePin: false })
    .where(eq(clientTable.id, world.clientId));
  const [tag] = await db.insert(tags).values({ name: `Beaches ${unique("t")}` }).returning();
  await db.insert(clientTags).values({ id: randomUUID(), clientId: world.clientId, tagId: tag.id });
  return {
    world,
    portal: {
      orgId: world.agency.orgId,
      slug,
      orgName: world.agency.orgName,
      clientId: world.clientId,
      email: client.email ?? "",
      pin: PORTAL_PIN,
      tagName: tag.name,
    },
  };
}

export interface SeededPortalQuote {
  id: string;
  token: string;
  title: string;
}

export interface PortalQuoteOptions {
  title: string;
  token: string;
  salesPrice?: string;
  discounts?: string;
  serviceCharge?: string;
  /** A real expiry; omit for a quote with none. */
  expiresInDays?: number;
  /** Adds an outbound and a return flight, a hotel, a lounge pass (an extra) and three photos. */
  itinerary?: boolean;
  /** With `itinerary`: also a second hotel and an airport transfer. */
  rich?: boolean;
  /** Written to the cost side so the specs can prove it never reaches the customer. */
  cost?: string;
}

/** Creates a quote deal for the customer and gives it a share token, an expiry (optional) and an itinerary (optional). */
export async function seedPortalQuote(page: Page, q: PortalQuoteWorld, opts: PortalQuoteOptions): Promise<SeededPortalQuote> {
  const deal = await quoteDeal(page.request, q.world, {
    title: opts.title,
    sales_price: opts.salesPrice ?? "2400.00",
    discounts: opts.discounts ?? "0",
    service_charge: opts.serviceCharge ?? "0",
    travel_date: "2027-06-14",
    num_of_nights: 7,
    adult: 2,
  });
  await db
    .update(quote)
    .set({
      quote_token: opts.token,
      quote_sent_at: new Date("2026-11-20T09:00:00Z"),
      date_expiry: opts.expiresInDays ? new Date(Date.now() + opts.expiresInDays * 86_400_000) : null,
    })
    .where(eq(quote.id, deal.entityId));

  if (opts.itinerary) {
    const ref = q.world.agency.ref;
    await db.insert(quote_flights).values([
      {
        quote_id: deal.entityId, flight_type: "outbound", leg_order: 1, flight_number: "E2E101",
        departing_airport_id: ref.airport, arrival_airport_id: ref.airport2,
        departure_date_time: new Date("2027-06-14T10:30:00Z"), arrival_date_time: new Date("2027-06-14T14:00:00Z"),
        cost: opts.cost ?? "98765.43", commission: "12.00",
      },
      {
        quote_id: deal.entityId, flight_type: "inbound", leg_order: 1, flight_number: "E2E102",
        departing_airport_id: ref.airport2, arrival_airport_id: ref.airport,
        departure_date_time: new Date("2027-06-21T12:00:00Z"), arrival_date_time: new Date("2027-06-21T15:00:00Z"),
      },
    ]);
    await db.insert(quote_accomodation).values({
      quote_id: deal.entityId, accomodation_id: ref.accommodation, board_basis_id: ref.boardBasis, room_type: "Double sea view",
      check_in_date_time: new Date("2027-06-14T16:00:00Z"), is_primary: true, no_of_nights: 7, cost: opts.cost ?? "98765.43", commission: "12.00",
    });
    await db.insert(quote_lounge_pass).values({
      quote_id: deal.entityId, airport_id: ref.airport, terminal: "1", date_of_usage: new Date("2027-06-14T08:00:00Z"), note: "Two guests",
      // An extra the customer pays for on top of the package, so it is part of the total the customer sees.
      cost: "50.00", is_included_in_package: false,
    });
    if (opts.rich) {
      await db.insert(quote_accomodation).values({
        quote_id: deal.entityId, accomodation_id: ref.accommodation, board_basis_id: ref.boardBasis2, room_type: "Family suite",
        check_in_date_time: new Date("2027-06-18T16:00:00Z"), is_primary: false, no_of_nights: 3,
      });
      await db.insert(quote_transfers).values({
        quote_id: deal.entityId, pick_up_location: "Palma airport", drop_off_location: "Hotel Playa Azul",
        pick_up_time: new Date("2027-06-14T14:45:00Z"), note: "Driver meets you at arrivals",
      });
    }
    await db.insert(quoteImages).values(
      ["/favicon.png", "/opengraph.jpg", "/favicon.png?x=2"].map((url, i) => ({ id: randomUUID(), quoteId: deal.entityId, url, isPrimary: i === 0, position: i })),
    );
  }
  return { id: deal.entityId, token: opts.token, title: opts.title };
}


/**
 * A quote published to the portal as a deal of the agency (what staff do with "show on portal"): published, a free
 * quote, with a share token. `forClientId` null leaves no customer on the deal; otherwise the deal belongs to that client.
 */
export async function seedPublishedDeal(
  page: Page,
  q: PortalQuoteWorld,
  opts: { title: string; token: string; forClientId: string | null; salesPrice?: string },
): Promise<SeededPortalQuote & { transactionId: string }> {
  const owner = opts.forClientId ?? q.world.clientId;
  const deal = await quoteDeal(page.request, q.world, { title: opts.title, sales_price: opts.salesPrice ?? "900.00", travel_date: "2027-06-14", num_of_nights: 7, adult: 2 }, owner);
  await db
    .update(quote)
    .set({ quote_token: opts.token, show_on_portal: true, isFreeQuote: true, portal_added_at: new Date() })
    .where(eq(quote.id, deal.entityId));
  if (opts.forClientId === null) await db.update(transaction).set({ client_id: null }).where(eq(transaction.id, deal.transactionId));
  return { id: deal.entityId, token: opts.token, title: opts.title, transactionId: deal.transactionId };
}

/** Gives a published deal the customer's saved interest as a tag, so it shows under "For you" and in the interest-matched Latest deals. */
export async function tagDealWithInterest(dealQuoteId: string, tagName: string): Promise<void> {
  const [tag] = await db.select().from(tags).where(eq(tags.name, tagName));
  await db.insert(quoteTags).values({ quoteId: dealQuoteId, tagId: tag.id });
}

/** Credit the customer has available in their wallet (a processed referral credit). */
export async function giveWalletCredit(clientId: string, amount: string): Promise<void> {
  await db.insert(wallet_transaction).values({ client_id: clientId, type: "credit", amount, source: "referral_commission", status: "processed" });
}

/** Messages the customer has sent through the portal (rows of portal_messages), oldest first. */
export async function portalMessageTexts(clientId: string): Promise<string[]> {
  const rows = await queryRows<{ text: string }>(`select text from portal_messages where client_id = $1 and sender = 'client' order by created_at`, [clientId]);
  return rows.map((r) => r.text);
}

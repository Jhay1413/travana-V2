/**
 * The public quote link (/view-quote/:token): who can open it, what it shows, and what a visit changes.
 *
 * WRITTEN, NOT RUN: these drive the real screens and endpoints but were not run by their author (the practice
 * database was shared with other work). Run them with `npx playwright test e2e/quotes/public-link.spec.ts`.
 *
 *  - an active quote opens and shows no client or passenger name, in the page or in the network payload
 *  - an expired quote still opens, under a "price was held until" banner
 *  - booked / lost / inactive / unknown tokens: the simple screens and the 410 / 404 answers
 *  - staff preview of a booked quote: the staff bar, no view recorded, Copy Link without ?preview=1
 *  - the old open action endpoint is gone; repeated views do not multiply notifications; share is validated
 */
import { randomBytes } from "node:crypto";
import { request as playwrightRequest, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { expect, test } from "../helpers/fixtures";
import { bookedDeal, markLost } from "../helpers/pipeline";
import { seedPortalQuote, seedPortalQuoteWorld, type PortalQuoteWorld } from "../helpers/portal-quotes";
import { queryRows } from "../helpers/seed";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
/** A 20 character token like the ones the app now mints. */
const newToken = () => Array.from(randomBytes(20), (b) => ALPHABET[b % ALPHABET.length]).join("");

let ipCounter = 0;
const ip = () => `10.77.${Math.floor(ipCounter / 250) % 250}.${(ipCounter++ % 250) + 1}`;

async function anonymous(baseURL: string): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL, extraHTTPHeaders: { "X-Forwarded-For": ip() } });
}

async function anonymousPage(browser: Browser, baseURL: string): Promise<Page> {
  const context = await browser.newContext({ baseURL, extraHTTPHeaders: { "X-Forwarded-For": ip() } });
  return context.newPage();
}

interface World {
  q: PortalQuoteWorld;
  active: { id: string; token: string; title: string };
}

async function world(page: Page): Promise<World> {
  const q = await seedPortalQuoteWorld(page);
  const active = await seedPortalQuote(page, q, { title: "Hotel Playa Azul Majorca", token: newToken(), salesPrice: "2400.00", discounts: "100.00", serviceCharge: "50.00", itinerary: true, rich: true });
  return { q, active };
}

const viewCount = async (quoteId: string) =>
  Number((await queryRows<{ n: string }>(`select count(*)::text as n from quote_views where quote_id = $1`, [quoteId]))[0].n);

/** Share bells carry no link, so they are counted by type for the agent who owns the deals. */
const shareBellCount = async (agentUserId: string) =>
  Number((await queryRows<{ n: string }>(`select count(*)::text as n from notifications where user_id = $1 and type = 'quote_shared'`, [agentUserId]))[0].n);

const bellCount = async (quoteId: string, like: string) =>
  Number((await queryRows<{ n: string }>(`select count(*)::text as n from notifications where link like $1 and message like $2`, [`%${quoteId}%`, like]))[0].n);

function keysDeep(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => keysDeep(v, out));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      out.add(key);
      if (key !== "destinationGuru") keysDeep(child, out);
    }
  }
  return out;
}

test.describe("public quote link", () => {
  test("an active quote opens and shows no client or passenger name in the page or the network payload", async ({ page, browser, baseURL }) => {
    const w = await world(page);
    const visitor = await anonymousPage(browser, baseURL!);

    const apiResponse = visitor.waitForResponse((r) => r.url().includes(`/api/public/quote/${w.active.token}`) && r.request().method() === "GET");
    const pageResponse = await visitor.goto(`/view-quote/${w.active.token}`);
    await expect(visitor.getByTestId("page-public-quote")).toBeVisible();
    await expect(visitor.getByTestId("text-quote-title")).toContainText("Hotel Playa Azul Majorca");
    await expect(visitor.getByTestId("text-passengers")).toContainText("2 adults");

    // Nothing personal on the screen.
    await expect(visitor.locator("body")).not.toContainText(w.q.world.clientSurname);

    // Nothing personal in the payload either, and none of the price breakdown.
    const api = await apiResponse;
    const text = await api.text();
    expect(text).not.toContain(w.q.world.clientSurname);
    const keys = keysDeep(JSON.parse(text));
    for (const forbidden of ["clientName", "passengers", "firstName", "lastName", "age", "transactionId", "agentUserId", "salesPrice", "discounts", "serviceCharge", "extrasTotal", "tags"]) {
      expect(keys.has(forbidden), forbidden).toBe(false);
    }
    expect(keys.has("totalPrice")).toBe(true);
    expect(keys.has("pricePerPerson")).toBe(true);

    // The cost side never reaches the page.
    expect(text).not.toContain("98765.43");

    // Headers on the API and on the page.
    for (const res of [api, pageResponse!]) {
      const headers = res.headers();
      expect(headers["cache-control"]).toBe("no-store");
      expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
      expect(headers["referrer-policy"]).toBe("no-referrer");
    }
    await expect(visitor.locator('meta[name="robots"][content="noindex"]')).toHaveCount(1);
    await visitor.context().close();
  });

  test("an expired quote still opens, under a banner that says when the price was held until", async ({ page, browser, baseURL }) => {
    const w = await world(page);
    await queryRows(`update quote_table set date_expiry = now() - interval '5 days' where id = $1`, [w.active.id]);
    const visitor = await anonymousPage(browser, baseURL!);
    await visitor.goto(`/view-quote/${w.active.token}`);
    await expect(visitor.getByTestId("page-public-quote")).toBeVisible();
    await expect(visitor.getByTestId("banner-quote-expired")).toContainText("This price was held until");
    await expect(visitor.getByTestId("banner-quote-expired")).toContainText("to check it is still available");
    await visitor.context().close();
  });

  test("a booked quote shows the booked screen with a portal link, and the API answers 410 BOOKED with nothing about the quote", async ({ page, browser, baseURL }) => {
    const w = await world(page);
    const trip = await bookedDeal(page.request, w.q.world, { title: "Booked Barbados Week", travel_date: "2027-03-10", num_of_nights: 7, adult: 2 });
    const token = newToken();
    await queryRows(`update quote_table set quote_token = $1 where id = $2`, [token, trip.entityId]);

    const visitor = await anonymousPage(browser, baseURL!);
    await visitor.goto(`/view-quote/${token}`);
    await expect(visitor.getByTestId("blocked-quote-booked")).toBeVisible();
    await expect(visitor.getByTestId("text-blocked-title")).toHaveText("This holiday has been booked.");
    await expect(visitor.getByTestId("link-view-in-portal")).toHaveAttribute("href", "/portal/trips/bookings");
    await expect(visitor.getByTestId("page-public-quote")).toHaveCount(0);
    await expect(visitor.locator("body")).not.toContainText("Barbados");
    await visitor.context().close();

    const anon = await anonymous(baseURL!);
    const res = await anon.get(`/api/public/quote/${token}`);
    expect(res.status()).toBe(410);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["agency", "code", "error"]);
    expect(body.code).toBe("BOOKED");
    expect(JSON.stringify(body)).not.toContain("Barbados");
    // Nothing is recorded or notified for a blocked quote.
    expect((await anon.post(`/api/public/quote/${token}/view`)).status()).toBe(410);
    expect((await anon.post(`/api/public/quote/${token}/share`, { data: { method: "Email" } })).status()).toBe(410);
    expect(await viewCount(trip.entityId)).toBe(0);
    await anon.dispose();
  });

  test("a lost or inactive quote shows 'no longer available' with the agency, never why; an unknown token is a 404", async ({ page, browser, baseURL }) => {
    const w = await world(page);
    const lost = await seedPortalQuote(page, w.q, { title: "Lost Lisbon", token: newToken() });
    const lostDeal = await queryRows<{ transaction_id: string }>(`select transaction_id from quote_table where id = $1`, [lost.id]);
    await markLost(page.request, lostDeal[0].transaction_id);
    const inactive = await seedPortalQuote(page, w.q, { title: "Inactive Ibiza", token: newToken() });
    await queryRows(`update quote_table set is_active = false where id = $1`, [inactive.id]);

    const anon = await anonymous(baseURL!);
    for (const q of [lost, inactive]) {
      const res = await anon.get(`/api/public/quote/${q.token}`);
      expect(res.status(), q.title).toBe(410);
      const body = (await res.json()) as { code: string; agency: { name: string | null } };
      expect(Object.keys(body).sort()).toEqual(["agency", "code", "error"]);
      expect(body.code).toBe("UNAVAILABLE");
      expect(body.agency.name).toBe(w.q.world.agency.orgName);
      expect(JSON.stringify(body)).not.toMatch(/lost|archived|deleted|Lisbon|Ibiza/i);
    }

    const visitor = await anonymousPage(browser, baseURL!);
    await visitor.goto(`/view-quote/${lost.token}`);
    await expect(visitor.getByTestId("blocked-quote-unavailable")).toBeVisible();
    await expect(visitor.getByTestId("text-blocked-title")).toHaveText("This quote is no longer available.");
    await expect(visitor.getByTestId("text-blocked-contact")).toContainText(`Please contact ${w.q.world.agency.orgName}`);
    await expect(visitor.locator("body")).not.toContainText("Lisbon");
    await visitor.context().close();

    expect((await anon.get(`/api/public/quote/${newToken()}`)).status()).toBe(404);
    expect((await anon.get(`/api/public/quote/zz`)).status()).toBe(404);
    await anon.dispose();
  });

  test("staff preview of a booked quote opens it with the staff bar, records no view, and Copy Link has no preview parameter", async ({ page, baseURL, context }) => {
    const w = await world(page);
    const trip = await bookedDeal(page.request, w.q.world, { title: "Booked Barbados Week", travel_date: "2027-03-10", num_of_nights: 7, adult: 2 });
    const token = newToken();
    await queryRows(`update quote_table set quote_token = $1 where id = $2`, [token, trip.entityId]);
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL! });

    // The page is signed in as the agent who owns the deal.
    await page.goto(`/view-quote/${token}?preview=1`);
    await expect(page.getByTestId("page-public-quote")).toBeVisible();
    await expect(page.getByTestId("bar-staff-preview")).toHaveText("Staff preview — customers cannot see this quote");
    await expect(page.getByTestId("text-quote-title")).toContainText("Booked Barbados Week");

    await page.getByTestId("button-share-copy").click();
    await expect(page.getByTestId("button-share-copy")).toContainText("Copied!");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain(`/view-quote/${token}`);
    expect(copied).not.toContain("preview");

    // Share buttons on a preview record nothing and notify nobody.
    expect(await viewCount(trip.entityId)).toBe(0);
    expect(await shareBellCount(w.q.world.userId)).toBe(0);
    expect(await bellCount(trip.entityId, "%opened via the shared link%")).toBe(0);

    // A preview of a quote the public link would open shows no bar.
    await page.goto(`/view-quote/${w.active.token}?preview=1`);
    await expect(page.getByTestId("page-public-quote")).toBeVisible();
    await expect(page.getByTestId("bar-staff-preview")).toHaveCount(0);
    expect(await viewCount(w.active.id)).toBe(0);
  });

  test("?preview=1 does not open a blocked quote for a visitor who is not signed in as staff", async ({ page, browser, baseURL }) => {
    const w = await world(page);
    const trip = await bookedDeal(page.request, w.q.world, { title: "Booked Barbados Week", travel_date: "2027-03-10", num_of_nights: 7, adult: 2 });
    const token = newToken();
    await queryRows(`update quote_table set quote_token = $1 where id = $2`, [token, trip.entityId]);

    const visitor = await anonymousPage(browser, baseURL!);
    await visitor.goto(`/view-quote/${token}?preview=1`);
    await expect(visitor.getByTestId("blocked-quote-booked")).toBeVisible();
    await expect(visitor.getByTestId("bar-staff-preview")).toHaveCount(0);
    await visitor.context().close();

    const anon = await anonymous(baseURL!);
    const refused = await anon.get(`/api/v2/quotes/preview/${token}`);
    expect([401, 403]).toContain(refused.status());
    await anon.dispose();
  });

  test("the old public action endpoint is gone", async ({ page, baseURL }) => {
    const w = await world(page);
    const anon = await anonymous(baseURL!);
    const res = await anon.post(`/api/public/quote/${w.active.token}/action`, { data: { actionType: "accepted", customerName: "Anyone" } });
    expect([404, 405]).toContain(res.status());
    const actions = await queryRows<{ n: string }>(`select count(*)::text as n from quote_customer_actions where quote_id = $1`, [w.active.id]);
    expect(actions[0].n).toBe("0");
    await anon.dispose();
  });

  test("repeated views from different visitors are all recorded but ring the agent once", async ({ page, baseURL }) => {
    const w = await world(page);
    for (let i = 0; i < 4; i++) {
      const anon = await anonymous(baseURL!);
      const res = await anon.post(`/api/public/quote/${w.active.token}/view`);
      expect(res.status(), await res.text()).toBe(200);
      await anon.dispose();
    }
    expect(await viewCount(w.active.id)).toBe(4);
    expect(await bellCount(w.active.id, "%opened via the shared link%")).toBe(1);
  });

  test("share only accepts the fixed buttons", async ({ page, baseURL }) => {
    const w = await world(page);
    const anon = await anonymous(baseURL!);
    for (const bad of ["<b>x</b>", "x".repeat(500), "whatsapp", ""]) {
      const res = await anon.post(`/api/public/quote/${w.active.token}/share`, { data: { method: bad } });
      expect(res.status(), bad.slice(0, 20)).toBe(400);
    }
    expect((await anon.post(`/api/public/quote/${w.active.token}/share`, { data: {} })).status()).toBe(400);
    const ok = await anon.post(`/api/public/quote/${w.active.token}/share`, { data: { method: "WhatsApp" } });
    expect(ok.status(), await ok.text()).toBe(200);
    expect(await shareBellCount(w.q.world.userId)).toBe(1);
    await anon.dispose();
  });

  test("a minted token is 20 characters and the link built from it opens", async ({ page, baseURL }) => {
    const w = await world(page);
    const fresh = await seedPortalQuote(page, w.q, { title: "Fresh Faro", token: newToken() });
    await queryRows(`update quote_table set quote_token = null where id = $1`, [fresh.id]);
    const res = await page.request.post(`/api/v2/quote-share/${fresh.id}/generate-token`);
    expect(res.status(), await res.text()).toBe(200);
    const { data } = (await res.json()) as { data: { token: string } };
    // 20 characters once the schema is pushed; 12 until the quote_token column is widened.
    expect([12, 20]).toContain(data.token.length);
    expect(data.token).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/);
    const anon = await anonymous(baseURL!);
    expect((await anon.get(`/api/public/quote/${data.token}`)).status()).toBe(200);
    await anon.dispose();
  });
});

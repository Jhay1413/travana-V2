/**
 * Customer portal, Phase 3: the Home screen in the new look. A customer with a booking, quotes and deals sees the
 * greeting, the price-held card, the counts, the next journey, the quotes rail and the deals; a brand-new customer
 * sees the friendly first-time version.
 */
import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "../helpers/fixtures";
import { seedPortalCustomer, startSignedIn } from "../helpers/portal";
import {
  giveWalletCredit,
  portalMessageTexts,
  seedPortalQuote,
  seedPortalQuoteWorld,
  seedPublishedDeal,
  tagDealWithInterest,
  type PortalQuoteWorld,
  type SeededPortalQuote,
} from "../helpers/portal-quotes";
import { bookedDeal, daysFromToday } from "../helpers/pipeline";
import { queryRows } from "../helpers/seed";

const token = () => randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

interface Fixture {
  q: PortalQuoteWorld;
  /** Photos, an expiry in 12 days. */
  full: SeededPortalQuote;
  /** Expires in 3 days: the soonest, so it is the "price held" card. */
  soon: SeededPortalQuote;
  /** No expiry. */
  open: SeededPortalQuote;
  deal: SeededPortalQuote;
}

/** A customer with a booking 40 days away, three open quotes and one published deal that matches their interest. */
async function fixture(page: Page): Promise<Fixture> {
  const q = await seedPortalQuoteWorld(page);
  const full = await seedPortalQuote(page, q, { title: "Hotel Playa Azul Majorca", token: token(), salesPrice: "2400.00", expiresInDays: 12, itinerary: true });
  const soon = await seedPortalQuote(page, q, { title: "Tenerife Sun Break", token: token(), salesPrice: "1000.00", expiresInDays: 3 });
  const open = await seedPortalQuote(page, q, { title: "Algarve Golf Escape", token: token(), salesPrice: "1800.00" });
  await bookedDeal(page.request, q.world, { title: "Cretan Villa Week", travel_date: daysFromToday(40), num_of_nights: 7, adult: 2, child: 1 });
  const deal = await seedPublishedDeal(page, q, { title: "Cyprus Beach Deal", token: token(), forClientId: null, salesPrice: "899.00" });
  await tagDealWithInterest(deal.id, q.portal.tagName);
  await startSignedIn(page, q.portal);
  return { q, full, soon, open, deal };
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);

test.describe("customer portal: Home", () => {
  test("a very long surname stays inside the screen at 360px (the heading wraps and steps down)", async ({ page }) => {
    const c = await seedPortalCustomer({ surname: "Wolfeschlegelsteinhausenbergerdorff" });
    await startSignedIn(page, c);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/portal");
    const h1 = page.getByTestId("text-greeting");
    await expect(h1).toContainText("Pat");
    const box = await h1.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 360, `heading box ${JSON.stringify(box)} is inside the 360px screen`).toBe(true);
    expect(await overflow(page)).toBeLessThanOrEqual(360);
  });

  test("a very long quote title stays inside the screen at 360px on the quote page", async ({ page }) => {
    const q = await seedPortalQuoteWorld(page);
    const long = await seedPortalQuote(page, q, { title: "Pneumonoultramicroscopicsilicovolcanoconiosis Resort", token: token(), salesPrice: "1000.00" });
    await startSignedIn(page, q.portal);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`/portal/quote/${long.token}`);
    const h1 = page.getByTestId("quote-title");
    await expect(h1).toBeVisible();
    const box = await h1.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 360, `title box ${JSON.stringify(box)} is inside the 360px screen`).toBe(true);
    expect(await overflow(page)).toBeLessThanOrEqual(360);
  });

  test("the price-held date is the UK day: an expiry of 00:30 BST on 1 July reads 1 Jul, not 30 Jun", async ({ page }) => {
    const q = await seedPortalQuoteWorld(page);
    const held = await seedPortalQuote(page, q, { title: "Midnight Expiry Break", token: token(), salesPrice: "1000.00", expiresInDays: 30 });
    await queryRows("update quote_table set date_expiry = $1 where id = $2", ["2027-06-30T23:30:00Z", held.id]);
    await startSignedIn(page, q.portal);
    await page.goto("/portal");
    await expect(page.getByTestId("home-price-held")).toContainText("until 1 Jul 2027");
    await page.goto("/portal/trips/quotes");
    await expect(page.getByTestId(`quote-held-${held.id}`)).toContainText("1 Jul 2027");
  });

  test("the Trips badge is the same number as Home's quotes to consider: answered quotes are not counted", async ({ page }) => {
    const { soon } = await fixture(page);
    await page.goto("/portal");
    await expect(page.getByTestId("nav-badge-trips")).toHaveText("3");
    const auth = { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("portal_token"))}` };
    await page.request.post(`/api/v2/portal/quotes/${soon.token}/action`, { headers: auth, data: { action: "declined", reason: "Too expensive", wantsSimilar: false } });
    await page.goto("/portal");
    await expect(page.getByRole("button", { name: "2 quotes to consider" })).toBeVisible();
    await expect(page.getByTestId("nav-badge-trips")).toHaveText("2");
  });

  test("a booking with no recorded length shows its date without nights or an end date", async ({ page }) => {
    const q = await seedPortalQuoteWorld(page);
    await bookedDeal(page.request, q.world, { title: "Day Trip To Bruges", travel_date: daysFromToday(10), num_of_nights: 0, adult: 2 });
    await startSignedIn(page, q.portal);
    await page.goto("/portal");
    const journey = page.getByTestId("home-next-journey");
    await expect(journey).toContainText("Day Trip To Bruges");
    await expect(journey).not.toContainText(/night/i);
    await expect(journey).not.toContainText(/ to /);
  });

  test("shows the greeting, the price-held card, the counts, the next journey and the quotes rail", async ({ page }) => {
    const { soon } = await fixture(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/portal");

    await expect(page.getByTestId("portal-home")).toBeVisible();
    await expect(page.getByTestId("home-greeting-time")).toHaveText(/^Good (morning|afternoon|evening)$/);
    await expect(page.getByTestId("text-greeting")).toContainText("Cora");
    await expect(page.getByTestId("home-hero-line")).toContainText(/Everything .+ is planning for you\./);
    await expect(page.getByTestId("home-next-holiday-line")).toHaveText(/^Your next holiday is (39|40|41) days away\.$/);
    await expect(page.getByTestId("nav-tab-home")).toHaveAttribute("aria-current", "page");

    // Coming up: the soonest-expiring undecided quote, in words and with the customer total.
    const held = page.getByTestId("home-price-held");
    await expect(held).toContainText("Tenerife Sun Break");
    await expect(page.getByTestId("home-price-held-line")).toHaveText("3 days left at £1,000.00");
    await expect(page.getByTestId("home-rewards")).toHaveCount(0);

    // Counts: three quotes still to consider, one holiday booked.
    await expect(page.getByRole("button", { name: "3 quotes to consider" })).toBeVisible();
    await expect(page.getByRole("button", { name: "1 holiday booked" })).toBeVisible();

    // Next journey.
    const journey = page.getByTestId("home-next-journey");
    await expect(journey).toContainText("Your next journey");
    await expect(journey).toContainText("Cretan Villa Week");
    await expect(journey).toContainText("7 nights");
    await expect(journey).toContainText("2 adults, 1 child");

    // The quotes rail has all three.
    for (const id of [soon.id]) await expect(page.getByTestId(`home-quote-${id}`)).toBeVisible();
    await expect(page.getByTestId("home-quotes-track").locator("button")).toHaveCount(3);

    // Nothing money-owed or passport-related anywhere on the page.
    const text = await page.getByTestId("portal-home").innerText();
    expect(text).not.toMatch(/balance|passport/i);
  });

  test("'View quote' on the price-held card and on a rail card opens that quote", async ({ page }) => {
    const { soon, full } = await fixture(page);
    await page.goto("/portal");
    await page.getByTestId("home-price-held-view").click();
    await expect(page).toHaveURL(new RegExp(`/portal/quote/${soon.token}$`));
    await expect(page.getByTestId("quote-title")).toContainText("Tenerife Sun Break");

    await page.goto("/portal");
    await page.getByTestId(`home-quote-${full.id}`).click();
    await expect(page).toHaveURL(new RegExp(`/portal/quote/${full.token}$`));
    await expect(page.getByTestId("quote-title")).toContainText("Hotel Playa Azul Majorca");
  });

  test("the summary rows, 'See all' and the next journey open Trips", async ({ page }) => {
    await fixture(page);
    await page.goto("/portal");
    await page.getByRole("button", { name: "3 quotes to consider" }).click();
    await expect(page).toHaveURL(/\/portal\/trips\/quotes$/);
    await page.goto("/portal");
    await page.getByRole("button", { name: "1 holiday booked" }).click();
    await expect(page).toHaveURL(/\/portal\/trips\/bookings$/);
    await page.goto("/portal");
    await page.getByTestId("home-next-booking").click();
    await expect(page).toHaveURL(/\/portal\/booking\/[0-9a-f-]{36}$/);
    await page.goto("/portal");
    await page.getByTestId("home-quotes-see-all").click();
    await expect(page).toHaveURL(/\/portal\/trips\/quotes$/);
  });

  test("the quotes rail scrolls with the mouse (arrow buttons) and with the keyboard", async ({ page }) => {
    await fixture(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/portal");
    const track = page.getByTestId("home-quotes-track");
    await expect(track).toBeVisible();
    const left = () => track.evaluate((el) => el.scrollLeft);

    await expect(page.getByTestId("home-quotes-prev")).toBeDisabled();
    await page.getByTestId("home-quotes-next").click();
    await expect.poll(left).toBeGreaterThan(50);
    await expect(page.getByTestId("home-quotes-prev")).toBeEnabled();
    await page.getByTestId("home-quotes-prev").click();
    await expect.poll(left).toBeLessThan(5);

    await track.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(left).toBeGreaterThan(50);
    await page.keyboard.press("ArrowLeft");
    await expect.poll(left).toBeLessThan(5);
  });

  test("a deal's 'I'm interested' tells the agent once and shows the told state, also after a reload", async ({ page }) => {
    const { q, deal } = await fixture(page);
    await page.goto("/portal");
    const card = page.getByTestId(`home-deal-${deal.id}`);
    await expect(card).toBeVisible();
    await expect(card).toContainText("Cyprus Beach Deal");
    await expect(card).toContainText("from £899.00");
    await expect(page.getByTestId("home-for-you")).toBeVisible();

    await page.getByTestId(`button-deal-interest-${deal.id}`).click();
    await expect(page.getByTestId(`deal-told-${deal.id}`)).toContainText("has been told");
    await expect(page.getByTestId(`button-deal-interest-${deal.id}`)).toHaveCount(0);

    const interested = async () => (await portalMessageTexts(q.portal.clientId)).filter((t) => t.includes(deal.id));
    expect(await interested()).toHaveLength(1);

    await page.reload();
    await expect(page.getByTestId(`deal-told-${deal.id}`)).toBeVisible();
    expect(await interested()).toHaveLength(1);

    // The told state comes from the server, not the browser: nothing is kept in browser storage, a repeat from
    // anywhere sends nothing and answers alreadyTold, and a fresh browser for the same customer sees it too.
    expect(await page.evaluate(() => Object.keys(sessionStorage).concat(Object.keys(localStorage)).filter((k) => k.includes("told")))).toEqual([]);
    const headers = { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("portal_token"))}` };
    const repeat = await page.request.post("/api/v2/portal/interest", { headers, data: { dealId: deal.id } });
    expect(await repeat.json()).toEqual({ success: true, alreadyTold: true });
    expect(await interested()).toHaveLength(1);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await signBackIn(page, q.portal);
    await page.goto("/portal");
    await expect(page.getByTestId(`deal-told-${deal.id}`)).toBeVisible();

    // View deal opens the published deal's quote page; Browse all deals opens the Deals tab.
    await page.getByTestId(`home-view-deal-${deal.id}`).click();
    await expect(page).toHaveURL(new RegExp(`/portal/quote/${deal.token}$`));
    await page.goto("/portal");
    await page.getByTestId("home-browse-deals").click();
    await expect(page).toHaveURL(/\/portal\/deals$/);
  });

  test("Request a quote opens a themed sheet, posts into Messages once, and says the agent will reply there", async ({ page }) => {
    const { q } = await fixture(page);
    await page.goto("/portal");
    await page.getByTestId("button-request-quote").click();
    const sheet = page.getByTestId("sheet-request-quote");
    await expect(sheet).toBeVisible();

    // Destination is required: an empty form sends nothing.
    await page.getByTestId("button-submit-quote-request").click();
    expect(await portalMessageTexts(q.portal.clientId)).toEqual([]);

    await page.getByTestId("input-destination").fill("Lisbon");
    await page.getByTestId("input-dates").fill("September 2027, 5 nights");
    await page.getByTestId("input-travellers").fill("3");
    await page.getByTestId("input-notes").fill("Near the old town");
    await page.getByTestId("button-submit-quote-request").click();

    await expect(page.getByTestId("text-quote-request-success")).toBeVisible();
    await expect(page.getByTestId("quote-request-sent")).toContainText("will reply in Messages");
    const sentMessages = await portalMessageTexts(q.portal.clientId);
    expect(sentMessages).toHaveLength(1);
    for (const part of ["Quote Request:", "Destination: Lisbon", "Dates: September 2027, 5 nights", "Travellers: 3", "Notes: Near the old town"]) expect(sentMessages[0]).toContain(part);

    await page.getByTestId("button-quote-request-messages").click();
    await expect(page).toHaveURL(/\/portal\/messages$/);
    await expect(page.getByText(/Destination: Lisbon/)).toBeVisible();
  });

  test("the agent block names the agency and opens Messages", async ({ page }) => {
    const { q } = await fixture(page);
    await page.goto("/portal");
    await expect(page.getByTestId("home-agent")).toBeVisible();
    await expect(page.getByTestId("home-agency-name")).toContainText(q.portal.orgName);
    await page.getByTestId("home-message-agent").click();
    await expect(page).toHaveURL(/\/portal\/messages$/);
  });

  test("a customer with wallet credit sees the Rewards card, which opens Referrals & rewards", async ({ page }) => {
    const { q } = await fixture(page);
    await giveWalletCredit(q.portal.clientId, "25.50");
    await page.goto("/portal");
    const card = page.getByTestId("home-rewards");
    await expect(card).toContainText("£25.50 in your wallet");
    await page.getByTestId("home-rewards-link").click();
    await expect(page).toHaveURL(/\/portal\/referrals$/);
  });

  test("a brand-new customer sees the greeting, a friendly line, Request a quote and the deals, and nothing that looks broken", async ({ page }) => {
    const c = await seedPortalCustomer();
    await startSignedIn(page, c);
    await page.goto("/portal");

    await expect(page.getByTestId("text-greeting")).toContainText("Pat");
    await expect(page.getByTestId("home-first-time-line")).toBeVisible();
    await expect(page.getByTestId("button-request-quote")).toBeVisible();
    await expect(page.getByTestId("home-deals-footer")).toBeVisible();
    await expect(page.getByTestId("home-deals-empty")).toBeVisible();
    await expect(page.getByTestId("home-agent")).toBeVisible();
    for (const id of ["home-coming-up", "home-summary", "home-next-journey", "home-quotes", "home-next-holiday-line"]) {
      await expect(page.getByTestId(id)).toHaveCount(0);
    }
    expect(await page.getByTestId("portal-home").innerText()).not.toMatch(/balance|passport|undefined|NaN/i);
  });

  test("works at 360px wide: nothing overflows sideways, for a full customer and a brand-new one", async ({ page }) => {
    await fixture(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/portal");
    await expect(page.getByTestId("home-quotes")).toBeVisible();
    await expect(page.getByTestId("home-price-held")).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(360);

    await page.getByTestId("button-request-quote").click();
    await expect(page.getByTestId("sheet-request-quote")).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(360);
  });

  test("the first-time Home also fits 360px", async ({ page }) => {
    const c = await seedPortalCustomer();
    await startSignedIn(page, c);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/portal");
    await expect(page.getByTestId("home-first-time-line")).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(360);
  });

  test("the summary endpoint holds only the signed-in customer's data, no cost keys, and needs a session", async ({ page }) => {
    const { q, soon } = await fixture(page);
    const mine = { Authorization: `Bearer ${await signInToken(page, q.portal)}` };
    const res = await page.request.get("/api/v2/portal/summary", { headers: mine });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { firstName: string; counts: { quotesAwaiting: number; upcomingBookings: number }; priceHeld: { token: string }; nextBooking: { title: string } };
    expect(body.firstName).toBe("Cora");
    expect(body.counts).toEqual({ quotesAwaiting: 3, upcomingBookings: 1 });
    expect(body.priceHeld.token).toBe(soon.token);
    expect(body.nextBooking.title).toBe("Cretan Villa Week");
    expect(JSON.stringify(body)).not.toMatch(/98765|commission|profit|supplier|salesPrice|cost|agentUserId/i);

    // Another customer gets their own, empty, summary; no token gets 401.
    const other = await seedPortalCustomer();
    const theirs = await page.request.get("/api/v2/portal/summary", { headers: { Authorization: `Bearer ${await signInToken(page, other)}` } });
    const theirBody = (await theirs.json()) as { firstName: string; counts: { quotesAwaiting: number; upcomingBookings: number }; priceHeld: unknown; nextBooking: unknown };
    expect(theirBody.firstName).toBe("Pat");
    expect(theirBody.counts).toEqual({ quotesAwaiting: 0, upcomingBookings: 0 });
    expect(theirBody.priceHeld).toBeNull();
    expect(theirBody.nextBooking).toBeNull();
    expect(JSON.stringify(theirBody)).not.toContain(soon.token);
    expect((await page.request.get("/api/v2/portal/summary")).status()).toBe(401);
  });
});

/** Signs the same customer in again on an empty browser (as another device would be), with the wizard and banner out of the way. */
async function signBackIn(page: Page, who: { email: string; pin: string; slug: string }): Promise<void> {
  const token = await signInToken(page, who);
  await page.evaluate((t) => {
    localStorage.setItem("portal_token", t);
    localStorage.setItem("portal_setup_wizard_done", "1");
    sessionStorage.setItem("portal_push_banner_dismissed", "1");
  }, token);
}

async function signInToken(page: Page, who: { email: string; pin: string; slug: string }): Promise<string> {
  const res = await page.request.post("/api/v2/portal/login", { data: { email: who.email, pin: who.pin, org: who.slug } });
  expect(res.status()).toBe(200);
  return ((await res.json()) as { token: string }).token;
}

/**
 * Customer portal, Phase 2: the Quotes list (My quotes) and the quote screen, with the customer's decision
 * ("I'm interested", "Not interested", Undo) and what the agent sees of it on the staff side.
 */
import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "../helpers/fixtures";
import { apiCreateClient, openHoliday } from "../helpers/deals";
import { seedPortalCustomer, startSignedIn } from "../helpers/portal";
import { seedPortalQuote, seedPortalQuoteWorld, seedPublishedDeal, type PortalQuoteWorld, type SeededPortalQuote } from "../helpers/portal-quotes";
import { queryRows } from "../helpers/seed";
import { bookedDeal } from "../helpers/pipeline";

const token = () => randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

interface Fixture {
  q: PortalQuoteWorld;
  /** Flight + hotel + a lounge pass (an extra) + three photos, an expiry in 30 days, sent on 20 Nov 2026. */
  full: SeededPortalQuote;
  /** No itinerary, no photos and no expiry date. */
  plain: SeededPortalQuote;
}

async function fixture(page: Page): Promise<Fixture> {
  const q = await seedPortalQuoteWorld(page);
  const full = await seedPortalQuote(page, q, {
    title: "Hotel Playa Azul Majorca",
    token: token(),
    salesPrice: "2400.00",
    discounts: "100.00",
    serviceCharge: "50.00",
    expiresInDays: 30,
    itinerary: true,
  });
  const plain = await seedPortalQuote(page, q, { title: "Tenerife Sun Break", token: token(), salesPrice: "1000.00" });
  await startSignedIn(page, q.portal);
  return { q, full, plain };
}

const actionRows = (quoteId: string) =>
  queryRows<{ action_type: string; message: string | null; customer_name: string | null; reason: string | null; wants_similar: boolean | null }>(
    `select action_type, message, customer_name, reason, wants_similar from quote_customer_actions where quote_id = $1 order by created_at`,
    [quoteId],
  );

const notificationCount = async (userId: string, type: string) =>
  Number((await queryRows<{ n: string }>(`select count(*) as n from notifications where user_id = $1 and type = $2`, [userId, type]))[0].n);

test.describe("customer portal: quotes list", () => {
  test("shows each quote with its photo, operator, dates, facts and customer price, and the held line only where there is a real expiry", async ({ page }) => {
    const { full, plain } = await fixture(page);
    await page.goto("/portal/quotes");

    await expect(page.getByTestId("portal-quotes")).toBeVisible();
    await expect(page.getByTestId(`quote-card-${full.id}`)).toBeVisible();
    await expect(page.getByTestId(`quote-card-${plain.id}`)).toBeVisible();
    // The Quotes badge counts both.
    await expect(page.getByTestId("nav-badge-quotes")).toHaveText("2");

    const card = page.getByTestId(`quote-card-${full.id}`);
    // 2400 - 100 discount + 50 service charge + 50 extra not in the package = 2,400; per person 1,200.
    await expect(page.getByTestId(`quote-price-${full.id}`)).toHaveText("£2,400.00");
    await expect(card).toContainText("£1,200.00 per person");
    await expect(page.getByTestId(`quote-operator-${full.id}`)).toHaveText("E2E Sun Holidays");
    await expect(card).toContainText("Majorca, Spain");
    await expect(card).toContainText("7 nights · All Inclusive · 2 adults");
    await expect(card).toContainText("14 Jun 2027 to 21 Jun 2027");
    await expect(card).toContainText("3 photos");
    await expect(card.locator("img").first()).toBeVisible();
    await expect(page.getByTestId(`quote-held-${full.id}`)).toHaveText(/^Price held for \d+ more days, until /);

    // No expiry date: no "price held" line anywhere on that card (nothing is invented).
    await expect(page.getByTestId(`quote-price-${plain.id}`)).toHaveText("£1,000.00");
    await expect(page.getByTestId(`quote-held-${plain.id}`)).toHaveCount(0);
    await expect(page.getByTestId(`quote-card-${plain.id}`)).not.toContainText(/price held/i);
  });

  test("works from 360px wide: the list sits under the 480px hero, the first quote is reachable and nothing overflows sideways", async ({ page }) => {
    const { full } = await fixture(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/portal/quotes");
    const first = page.locator('[data-testid^="quote-card-"]').first();
    await first.scrollIntoViewIfNeeded();
    await expect(first).toBeVisible();
    // The reference hero is 480px tall, so the list starts below the first screen.
    const box = await first.boundingBox();
    expect(box?.y ?? 0).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    // Tap targets are at least 44px.
    const nav = await page.getByTestId("nav-tab-quotes").boundingBox();
    expect(nav?.height ?? 0).toBeGreaterThanOrEqual(43.5); // 44px, give or take sub-pixel rounding
    await expect(page.getByTestId(`quote-card-${full.id}`)).toBeVisible();
  });

  test("a customer with no quotes sees a plain empty state that names their agent", async ({ page }) => {
    const c = await seedPortalCustomer();
    await startSignedIn(page, c);
    await page.goto("/portal/quotes");
    await expect(page.getByTestId("quotes-empty")).toBeVisible();
    await expect(page.getByTestId("quotes-empty")).toContainText(/Message .+ to start planning|Message your agent to start planning/);
    await expect(page.getByTestId("nav-badge-quotes")).toHaveCount(0);
  });

  test("the old /api/portal paths still answer, with the same quotes as the v2 path", async ({ page }) => {
    const { full } = await fixture(page);
    await page.goto("/portal/quotes");
    const auth = { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("portal_token"))}` };
    const v1 = await page.request.get("/api/portal/quotes", { headers: auth });
    const v2 = await page.request.get("/api/v2/portal/quotes", { headers: auth });
    expect(v1.status()).toBe(200);
    expect(v2.status()).toBe(200);
    expect(((await v1.json()) as { id: string }[]).map((r) => r.id).sort()).toEqual(((await v2.json()) as { id: string }[]).map((r) => r.id).sort());
    const owns = await page.request.get(`/api/portal/quote/${full.token}/owns`, { headers: auth });
    expect(await owns.json()).toEqual({ found: true, owns: true, isPublicDeal: false });
  });
});

test.describe("customer portal: the quote screen", () => {
  test("opens from the list and renders the whole itinerary in date order: lounge, outbound flight, hotel, return flight", async ({ page }) => {
    const { full } = await fixture(page);
    await page.goto("/portal/quotes");
    await page.getByTestId(`quote-card-${full.id}`).click();
    await expect(page).toHaveURL(new RegExp(`/portal/quote/${full.token}$`));

    await expect(page.getByTestId("quote-title")).toContainText("Hotel Playa Azul Majorca");
    await expect(page.getByTestId("quote-total")).toHaveText("£2,400.00");
    await expect(page.getByTestId("nav-tab-quotes")).toHaveAttribute("aria-current", "page");

    const kinds = await page.locator('[data-testid^="journey-item-"]').evaluateAll((els) => els.map((el) => el.getAttribute("data-kind")));
    expect(kinds).toEqual(["lounge", "flight-out", "hotel", "flight-in"]);
    const journey = page.getByTestId("quote-journey");
    await expect(journey).toContainText("Newcastle International");
    await expect(journey).toContainText("Palma de Mallorca");
    await expect(journey).toContainText("E2E101");
    await expect(journey).toContainText("Hotel Playa Azul");
    await expect(journey).toContainText("Double sea view");
    await expect(journey).toContainText("Terminal 1");
    // The hotel's star rating is not stored, so none is shown.
    await expect(page.getByTestId("portal-quote")).not.toContainText("★");

    // Facts, the held line (this quote has a real expiry) and the agent card.
    await expect(page.getByTestId("quote-details")).toContainText("E2E Sun Holidays");
    await expect(page.getByTestId("quote-held")).toContainText("Price held for");
    await expect(page.getByTestId("quote-agent-name")).toBeVisible();

    // Nothing from the cost side reaches the customer: not on the screen, not in the data.
    const body = await page.getByTestId("portal-quote").innerText();
    expect(body).not.toContain("98765");
    const auth = { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("portal_token"))}` };
    const res = await page.request.get(`/api/v2/portal/quotes/${full.token}`, { headers: auth });
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).not.toMatch(/98765|commission|profit|supplier|salesPrice|discount|serviceCharge|agentUserId/i);
  });

  test("a quote with no expiry shows no price-held line", async ({ page }) => {
    const { plain } = await fixture(page);
    await page.goto(`/portal/quote/${plain.token}`);
    await expect(page.getByTestId("quote-total")).toHaveText("£1,000.00");
    await expect(page.getByTestId("quote-held")).toHaveCount(0);
    await expect(page.getByTestId("portal-quote")).not.toContainText(/price held/i);
  });

  /** "I'm interested" full width, with "Not interested" and "Share" on one row directly below it, about half its width each. */
  async function expectDecisionTrio(page: Page, ids: { primary: string; no: string; share: string }) {
    const primary = await page.getByTestId(ids.primary).boundingBox();
    const no = await page.getByTestId(ids.no).boundingBox();
    const share = await page.getByTestId(ids.share).boundingBox();
    if (!primary || !no || !share) throw new Error("the decision buttons are not on screen");
    expect(Math.abs(no.y - share.y), "Not interested and Share are on one row").toBeLessThanOrEqual(1);
    expect(no.y, "the pair sits below I'm interested").toBeGreaterThanOrEqual(primary.y + primary.height);
    expect(no.y - (primary.y + primary.height), "directly below").toBeLessThanOrEqual(24);
    expect(no.x, "Not interested is on the left").toBeLessThan(share.x);
    for (const b of [no, share]) {
      expect(b.width).toBeGreaterThan(primary.width * 0.4);
      expect(b.width).toBeLessThan(primary.width * 0.55);
      expect(b.height).toBeGreaterThanOrEqual(47.5);
    }
    expect(primary.height).toBeGreaterThanOrEqual(51.5);
  }

  test("the price block has I'm interested full width with Not interested and Share side by side below it, and the navy bar after the details repeats the trio", async ({ page }) => {
    const { full } = await fixture(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/portal/quote/${full.token}`);

    const price = page.getByTestId("quote-price");
    await expect(price.getByTestId("button-interested")).toHaveText(/I'm interested/);
    await expect(price.getByTestId("button-not-interested")).toHaveText("Not interested");
    await expect(price.getByTestId("button-share")).toHaveText("Share");
    await expect(price.getByTestId("button-share").locator("svg")).toHaveCount(1);
    const priceBox = await price.boundingBox();
    const primary = await price.getByTestId("button-interested").boundingBox();
    expect(Math.abs((primary?.width ?? 0) - ((priceBox?.width ?? 0) - 0)), "full width of the price column (less its padding)").toBeLessThan((priceBox?.width ?? 0) * 0.2);
    await expectDecisionTrio(page, { primary: "button-interested", no: "button-not-interested", share: "button-share" });

    // The fixed bar and its overflow menu are gone.
    await expect(page.getByTestId("quote-actionbar")).toHaveCount(0);
    await expect(page.getByTestId("button-actionbar-more")).toHaveCount(0);

    // The navy bar after "The details": the total, the days left (this quote has an expiry), the same trio.
    const bar = page.getByTestId("quote-decision-bar");
    await expect(bar).toBeVisible();
    await expect(bar.getByTestId("quote-bar-total")).toHaveText(/£/);
    await expect(bar.getByTestId("quote-bar-days-left")).toContainText(/days? left|Last day/);
    await expect(bar.getByTestId("quote-bar-days-left")).toContainText("at this price");
    await expectDecisionTrio(page, { primary: "button-bar-interested", no: "button-bar-not-interested", share: "button-bar-share" });
    const details = await page.getByTestId("quote-details").boundingBox();
    const barBox = await bar.boundingBox();
    expect((barBox?.y ?? 0) >= (details?.y ?? 0) + (details?.height ?? 0), "the bar comes after the details").toBe(true);
  });

  test("a quote with no expiry has no days-left text in the bar", async ({ page }) => {
    const { plain } = await fixture(page);
    await page.goto(`/portal/quote/${plain.token}`);
    await expect(page.getByTestId("quote-decision-bar")).toBeVisible();
    await expect(page.getByTestId("quote-bar-days-left")).toHaveCount(0);
  });

  test("an upper I'm interested scrolls to the note field and focuses it; nothing is recorded until the bottom button is pressed", async ({ page }) => {
    const { full } = await fixture(page);
    await page.goto(`/portal/quote/${full.token}`);

    for (const id of ["button-interested", "button-bar-interested"]) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.getByTestId(id).click();
      const note = page.getByTestId("input-interest-note");
      await expect(note).toBeFocused();
      await expect(note).toBeInViewport();
      await expect(page.getByTestId("quote-thanks")).toHaveCount(0);
      expect(await actionRows(full.id), `nothing is recorded after ${id}`).toHaveLength(0);
    }

    await page.getByTestId("input-interest-note").fill("Later flight if possible");
    await page.getByTestId("button-interested-submit").click();
    await expect(page.getByTestId("quote-thanks")).toBeVisible();
    const rows = await actionRows(full.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action_type: "accepted", message: "Later flight if possible" });
    // The bottom button was the large one.
    await expect(page.getByTestId("button-interested")).toHaveCount(0);
  });

  test("the bottom I'm interested is the large button (58px high)", async ({ page }) => {
    const { full } = await fixture(page);
    await page.goto(`/portal/quote/${full.token}`);
    const box = await page.getByTestId("button-interested-submit").boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(57.5);
  });

  test("a quote that cannot be decided on shows Ask and Share two-up, with no I'm interested and no Not interested", async ({ page }) => {
    const { q } = await fixture(page);
    const deal = await seedPublishedDeal(page, q, { title: "Agency special", token: token(), forClientId: null });
    await page.goto(`/portal/quote/${deal.token}`);
    const ask = await page.getByTestId("button-ask-inline").boundingBox();
    const share = await page.getByTestId("button-share").boundingBox();
    expect(Math.abs((ask?.y ?? 0) - (share?.y ?? 99))).toBeLessThanOrEqual(1);
    expect(ask?.height ?? 0).toBeGreaterThanOrEqual(47.5);
    await expect(page.getByTestId("button-interested")).toHaveCount(0);
    await expect(page.getByTestId("button-not-interested")).toHaveCount(0);
    await expect(page.getByTestId("quote-decision-bar")).toHaveCount(0);
  });

  test("a customer who has said they are interested sees Ask and Share, and no decision buttons", async ({ page }) => {
    const { full } = await fixture(page);
    await page.goto(`/portal/quote/${full.token}`);
    await page.getByTestId("button-interested-submit").click();
    await expect(page.getByTestId("quote-thanks")).toBeVisible();
    await expect(page.getByTestId("button-ask-inline")).toBeVisible();
    await expect(page.getByTestId("button-share")).toBeVisible();
    await expect(page.getByTestId("button-interested")).toHaveCount(0);
    await expect(page.getByTestId("button-not-interested")).toHaveCount(0);
    await expect(page.getByTestId("quote-decision-bar")).toHaveCount(0);
  });

  for (const width of [360, 390]) {
    test(`at ${width}px nothing overflows sideways and no decision button label is clipped`, async ({ page }) => {
      const { full } = await fixture(page);
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/portal/quote/${full.token}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      for (const id of ["button-interested", "button-not-interested", "button-share", "button-bar-interested", "button-bar-not-interested", "button-bar-share", "button-interested-submit"]) {
        const button = page.getByTestId(id);
        await button.scrollIntoViewIfNeeded();
        const clipped = await button.evaluate((el) => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight || el.getBoundingClientRect().right > window.innerWidth);
        expect(clipped, `${id} is not clipped`).toBe(false);
      }
    });
  }

  test("the photo strip opens a viewer with arrow keys, a counter and alt text, and Escape closes it", async ({ page }) => {
    const { full } = await fixture(page);
    await page.goto(`/portal/quote/${full.token}`);

    await page.getByTestId("quote-photo-0").click();
    const viewer = page.getByTestId("quote-photo-viewer");
    await expect(viewer).toBeVisible();
    await expect(viewer).toContainText("1 / 3");
    await expect(page.getByTestId("viewer-image")).toHaveAttribute("alt", "Hotel Playa Azul Majorca, photo 1 of 3");
    await page.keyboard.press("ArrowRight");
    await expect(viewer).toContainText("2 / 3");
    await page.keyboard.press("ArrowLeft");
    await expect(viewer).toContainText("1 / 3");
    await page.keyboard.press("Escape");
    await expect(viewer).toHaveCount(0);

    await page.getByTestId("button-view-all-photos").click();
    await expect(page.getByTestId("quote-gallery")).toBeVisible();
    await page.getByTestId("gallery-photo-2").click();
    await expect(page.getByTestId("quote-photo-viewer")).toContainText("3 / 3");
  });

  test("another customer's token shows the not-found screen, and the API answers 404 for both reading and acting", async ({ page }) => {
    const { full } = await fixture(page);
    const other = await seedPortalCustomer();
    // Sign the page in as the other customer instead.
    await page.context().clearCookies();
    const login = await page.request.post("/api/v2/portal/login", { data: { email: other.email, pin: other.pin, org: other.slug } });
    const { token: otherToken, clientId } = (await login.json()) as { token: string; clientId: string };
    await page.addInitScript(
      ([t, id]) => {
        localStorage.setItem("portal_token", t);
        localStorage.setItem("portal_client_id", id);
        localStorage.setItem("portal_setup_wizard_done", "1");
        sessionStorage.setItem("portal_push_banner_dismissed", "1");
      },
      [otherToken, clientId],
    );

    await page.goto(`/portal/quote/${full.token}`);
    await expect(page.getByTestId("quote-not-found")).toBeVisible();
    await expect(page.getByTestId("quote-total")).toHaveCount(0);

    const auth = { Authorization: `Bearer ${otherToken}` };
    expect((await page.request.get(`/api/v2/portal/quotes/${full.token}`, { headers: auth })).status()).toBe(404);
    expect((await page.request.post(`/api/v2/portal/quotes/${full.token}/action`, { headers: auth, data: { action: "interested" } })).status()).toBe(404);
    expect((await page.request.get(`/api/v2/portal/quotes/NOPE1234`, { headers: auth })).status()).toBe(404);
    expect(await actionRows(full.id)).toHaveLength(0);
  });
});

test.describe("customer portal: the customer's decision", () => {
  test("I'm interested with a note shows the thank-you, writes one record and one notification, and the agent sees it on the quote", async ({ page }) => {
    const { q, full } = await fixture(page);
    await page.goto(`/portal/quote/${full.token}`);

    await page.getByTestId("input-interest-note").fill("A sea view please");
    await page.getByTestId("button-interested-submit").click();

    const thanks = page.getByTestId("quote-thanks");
    await expect(thanks).toBeVisible();
    await expect(thanks).toContainText("Thank you");
    await expect(thanks).toContainText("A sea view please");
    await expect(page.getByTestId("button-interested")).toHaveCount(0);
    await expect(page.getByTestId("quote-decision-bar")).toHaveCount(0);
    // Not interested is no longer offered once they have said they are interested; Ask and Share are.
    await expect(page.getByTestId("button-not-interested")).toHaveCount(0);
    await expect(page.getByTestId("button-ask-inline")).toBeVisible();

    // The same record and the same notification the shared page's Accept has always made: the existing "accepted" value.
    const rows = await actionRows(full.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action_type: "accepted", message: "A sea view please", reason: null, wants_similar: null });
    expect(rows[0].customer_name).toContain("Cora");
    expect(await notificationCount(q.world.agency.agentId, "quote_accepted")).toBe(1);

    // It survives a reload, and the list marks the quote.
    await page.reload();
    await expect(page.getByTestId("quote-thanks")).toBeVisible();
    await page.goto("/portal/quotes");
    await expect(page.getByTestId(`quote-badge-${full.id}`)).toHaveText("You're interested");

    // Staff side: the quote page shows it accepted, with the customer's note.
    await openHoliday(page, q.world.clientId, "quote", full.id);
    const card = page.getByTestId("holiday-views-card");
    await expect(card.getByTestId("views-customer-actions")).toContainText("Accepted the quote");
    await expect(card.getByTestId("views-customer-actions")).toContainText("A sea view please");
  });

  test("a double tap on I'm interested records and notifies once", async ({ page }) => {
    const { q, full } = await fixture(page);
    await page.goto(`/portal/quote/${full.token}`);
    const auth = { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("portal_token"))}` };
    const body = { action: "interested" };
    const [a, b] = await Promise.all([
      page.request.post(`/api/v2/portal/quotes/${full.token}/action`, { headers: auth, data: body }),
      page.request.post(`/api/v2/portal/quotes/${full.token}/action`, { headers: auth, data: body }),
    ]);
    expect([a.status(), b.status()]).toEqual([200, 200]);
    expect(await actionRows(full.id)).toHaveLength(1);
    expect(await notificationCount(q.world.agency.agentId, "quote_accepted")).toBe(1);
  });

  test("Not interested with a reason moves the quote to 'Not for you'; the agent sees the reason; Undo brings it back", async ({ page }) => {
    const { q, plain } = await fixture(page);
    await page.goto(`/portal/quote/${plain.token}`);

    await page.getByTestId("button-not-interested").click();
    const sheet = page.getByTestId("sheet-decline");
    await expect(sheet).toBeVisible();
    // The "send me something similar" tick starts on.
    await expect(sheet.getByTestId("check-similar")).toBeChecked();
    await sheet.getByTestId("chip-reason-0").click();
    await expect(sheet.getByTestId("chip-reason-0")).toHaveAttribute("aria-pressed", "true");
    await sheet.getByTestId("input-decline-note").fill("Cheaper please");
    await sheet.getByTestId("button-decline-submit").click();

    await expect(sheet).toHaveCount(0);
    const banner = page.getByTestId("quote-declined-banner");
    await expect(banner).toContainText("too expensive");
    await expect(page.getByTestId("button-interested")).toHaveCount(0);
    await expect(page.getByTestId("quote-decision-bar")).toHaveCount(0);

    const rows = await actionRows(plain.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action_type: "declined", message: "Cheaper please", reason: "Too expensive", wants_similar: true });
    expect(await notificationCount(q.world.agency.agentId, "quote_declined")).toBe(1);

    // The list: out of the main list, into "Not for you" with its reason.
    await page.goto("/portal/quotes");
    await expect(page.getByTestId(`quote-card-${plain.id}`)).toHaveCount(0);
    const row = page.getByTestId(`declined-row-${plain.id}`);
    await expect(row).toContainText("Tenerife Sun Break");
    await expect(row).toContainText("Too expensive");

    // Staff side: the decline shows with its reason and the wish for something similar.
    await openHoliday(page, q.world.clientId, "quote", plain.id);
    const actions = page.getByTestId("holiday-views-card").getByTestId("views-customer-actions");
    await expect(actions).toContainText("Not interested");
    await expect(actions).toContainText("Reason: Too expensive");
    await expect(actions).toContainText("Wants something similar");

    // Undo: back in the list, and the agent is told.
    await page.goto("/portal/quotes");
    await page.getByTestId(`button-undo-${plain.id}`).click();
    await expect(page.getByTestId(`quote-card-${plain.id}`)).toBeVisible();
    await expect(page.getByTestId(`declined-row-${plain.id}`)).toHaveCount(0);
    await expect.poll(async () => (await actionRows(plain.id)).map((r) => r.action_type)).toEqual(["declined", "reopened"]);
    expect(await notificationCount(q.world.agency.agentId, "quote_reopened")).toBe(1);
  });

  test("the declined banner on the quote has its own Undo", async ({ page }) => {
    const { plain } = await fixture(page);
    await page.goto(`/portal/quote/${plain.token}`);
    await page.getByTestId("button-not-interested").click();
    await page.getByTestId("button-decline-submit").click(); // no reason is fine
    await expect(page.getByTestId("quote-declined-banner")).toBeVisible();
    await page.getByTestId("button-undo-decline").click();
    await expect(page.getByTestId("quote-declined-banner")).toHaveCount(0);
    await expect(page.getByTestId("button-interested")).toBeVisible();
    expect((await actionRows(plain.id)).map((r) => r.action_type)).toEqual(["declined", "reopened"]);
  });

  test("a reason that is not one of the fixed chips is refused", async ({ page }) => {
    const { full } = await fixture(page);
    await page.goto(`/portal/quote/${full.token}`);
    const auth = { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("portal_token"))}` };
    const res = await page.request.post(`/api/v2/portal/quotes/${full.token}/action`, { headers: auth, data: { action: "declined", reason: "Because I said so" } });
    expect(res.status()).toBe(400);
    expect(await actionRows(full.id)).toHaveLength(0);
  });
});

test.describe("customer portal: sharing and asking", () => {
  test("Share > Copy link copies the existing public link, says what the recipient can see, and tells the agent it was shared", async ({ page, context }) => {
    const { q, full } = await fixture(page);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`/portal/quote/${full.token}`);

    await page.getByTestId("button-share").click();
    const sheet = page.getByTestId("sheet-share");
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("Anyone with the link can see the photos, the itinerary and the price");
    await expect(sheet.getByTestId("share-whatsapp")).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=.*view-quote/);
    await expect(sheet.getByTestId("share-sms")).toHaveAttribute("href", /^sms:/);
    await expect(sheet.getByTestId("share-email")).toHaveAttribute("href", /^mailto:/);

    await sheet.getByTestId("button-copy-link").click();
    await expect(sheet.getByTestId("share-copied")).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(`${new URL(page.url()).origin}/view-quote/${full.token}`);
    await expect.poll(() => notificationCount(q.world.agency.agentId, "quote_shared")).toBe(1);

    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
  });

  test("Ask the agent about this quote opens the Message sheet over the quote with that quote chosen", async ({ page }) => {
    const { full } = await fixture(page);
    await page.goto(`/portal/quote/${full.token}`);
    await page.getByTestId("button-ask-agent").click();
    await expect(page.getByTestId("sheet-message")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/portal/quote/${full.token}$`));
    await expect(page.getByTestId(`message-about-quote:${full.id}`)).toHaveAttribute("aria-checked", "true");
  });
});

test.describe("customer portal: published deals are for the agency's own customers only", () => {
  const bearerFor = async (page: Page) => ({ Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("portal_token"))}` });

  test("a customer reads their own agency's published deal (and Share is offered, there being no customer on it), cannot decide on it, and the view is recorded", async ({ page }) => {
    const { q } = await fixture(page);
    const deal = await seedPublishedDeal(page, q, { title: "Agency special", token: token(), forClientId: null });
    await page.goto(`/portal/quote/${deal.token}`);
    await expect(page.getByTestId("quote-title")).toContainText("Agency special");
    await expect(page.getByTestId("button-share")).toBeVisible();
    await expect(page.getByTestId("button-ask-inline")).toBeVisible();
    // No decision controls anywhere: no "I'm interested", no "Not interested", no navy bar, no interest form.
    await expect(page.getByTestId("button-interested")).toHaveCount(0);
    await expect(page.getByTestId("button-not-interested")).toHaveCount(0);
    await expect(page.getByTestId("quote-decision-bar")).toHaveCount(0);
    await expect(page.getByTestId("quote-interest")).toHaveCount(0);
    const headers = await bearerFor(page);
    expect((await page.request.post(`/api/v2/portal/quotes/${deal.token}/action`, { headers, data: { action: "interested" } })).status()).toBe(404);
    // The old alias path: a view of a deal they may read is not a 403.
    await expect.poll(async () => (await queryRows(`select 1 from quote_views where quote_id = $1`, [deal.id])).length).toBeGreaterThan(0);
    expect((await page.request.post(`/api/portal/quote/${deal.token}/view`, { headers })).status()).toBe(200);
  });

  test("a published deal that belongs to another real customer of the agency is readable but is never offered for sharing", async ({ page }) => {
    const { q } = await fixture(page);
    const other = await apiCreateClient(page.request);
    const deal = await seedPublishedDeal(page, q, { title: "Someone else's deal", token: token(), forClientId: other.id });
    await page.goto(`/portal/quote/${deal.token}`);
    await expect(page.getByTestId("quote-title")).toContainText("Someone else");
    await expect(page.getByTestId("button-share")).toHaveCount(0);
    await expect(page.getByTestId("button-ask-inline")).toBeVisible();
  });

  test("another agency's customer gets the not-found screen for it, and 404 from the API for reading, acting and viewing", async ({ page }) => {
    const { q } = await fixture(page);
    const deal = await seedPublishedDeal(page, q, { title: "Agency special", token: token(), forClientId: null });
    const outsider = await seedPortalCustomer();
    await page.context().clearCookies();
    const login = await page.request.post("/api/v2/portal/login", { data: { email: outsider.email, pin: outsider.pin, org: outsider.slug } });
    const { token: otherToken, clientId } = (await login.json()) as { token: string; clientId: string };
    await page.addInitScript(
      ([t, id]) => {
        localStorage.setItem("portal_token", t);
        localStorage.setItem("portal_client_id", id);
        localStorage.setItem("portal_setup_wizard_done", "1");
        sessionStorage.setItem("portal_push_banner_dismissed", "1");
      },
      [otherToken, clientId],
    );
    await page.goto(`/portal/quote/${deal.token}`);
    await expect(page.getByTestId("quote-not-found")).toBeVisible();
    const headers = { Authorization: `Bearer ${otherToken}` };
    expect((await page.request.get(`/api/v2/portal/quotes/${deal.token}`, { headers })).status()).toBe(404);
    expect((await page.request.post(`/api/v2/portal/quotes/${deal.token}/action`, { headers, data: { action: "interested" } })).status()).toBe(404);
    expect((await page.request.post(`/api/v2/portal/quote/${deal.token}/view`, { headers })).status()).toBe(404);
    expect(await (await page.request.get(`/api/v2/portal/quote/${deal.token}/owns`, { headers })).json()).toEqual({ found: true, owns: false, isPublicDeal: false });
  });

  test("a quote on a deal that is no longer live is out of the list and its link is not found", async ({ page }) => {
    const { q, full } = await fixture(page);
    await queryRows(`update transaction set is_active = false where id = (select transaction_id from quote_table where id = $1)`, [full.id]);
    await page.goto("/portal/quotes");
    await expect(page.getByTestId(`quote-card-${full.id}`)).toHaveCount(0);
    await page.goto(`/portal/quote/${full.token}`);
    await expect(page.getByTestId("quote-not-found")).toBeVisible();
    expect(q.portal.clientId).toBeTruthy();
  });
});

test.describe("customer portal: the decision bar always shows the full price", () => {
  for (const width of [360, 390]) {
    test(`a seven-figure-pence total (£12,345.67) is shown in full at ${width}px`, async ({ page }) => {
      const q = await seedPortalQuoteWorld(page);
      const big = await seedPortalQuote(page, q, { title: "Grand Tour", token: token(), salesPrice: "12345.67", expiresInDays: 30 });
      await startSignedIn(page, q.portal);
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/portal/quote/${big.token}`);
      const total = page.getByTestId("quote-bar-total");
      await expect(total).toHaveText("£12,345.67");
      const fits = await total.evaluate((el) => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().right <= window.innerWidth);
      expect(fits, "the total is not clipped or off screen").toBe(true);
      const button = await page.getByTestId("button-bar-interested").boundingBox();
      expect(button?.height ?? 0).toBeGreaterThanOrEqual(43.5);
      expect((button?.x ?? 0) + (button?.width ?? 0)).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }

  test("the details line names a hotel once even when the quote has two stays there", async ({ page }) => {
    const q = await seedPortalQuoteWorld(page);
    const rich = await seedPortalQuote(page, q, { title: "Two stays", token: token(), itinerary: true, rich: true, expiresInDays: 30 });
    await startSignedIn(page, q.portal);
    await page.goto(`/portal/quote/${rich.token}`);
    const details = page.getByTestId("quote-details");
    await expect(details).toContainText("Hotel Playa Azul");
    await expect(details).not.toContainText("Hotel Playa Azul, Hotel Playa Azul");
    expect(await page.locator('[data-testid^="journey-item-hotel"]').count()).toBe(2);
  });
});

test.describe("customer portal: lost, archived and booked quotes", () => {
  const setStatus = (quoteId: string, status: string) => queryRows(`update quote_table set quote_status = $1 where id = $2`, [status, quoteId]);

  test("a quote staff marked lost or archived is not in the list and its link is not found", async ({ page }) => {
    const { q, full, plain } = await fixture(page);
    const lost = await seedPortalQuote(page, q, { title: "Lost Lisbon Break", token: token(), salesPrice: "700.00" });
    const archived = await seedPortalQuote(page, q, { title: "Archived Athens Trip", token: token(), salesPrice: "800.00" });
    await setStatus(lost.id, "lost");
    await setStatus(archived.id, "archived");

    await page.goto("/portal/quotes");
    await expect(page.getByTestId(`quote-card-${full.id}`)).toBeVisible();
    await expect(page.getByTestId(`quote-card-${plain.id}`)).toBeVisible();
    await expect(page.getByTestId(`quote-card-${lost.id}`)).toHaveCount(0);
    await expect(page.getByTestId(`quote-card-${archived.id}`)).toHaveCount(0);
    await expect(page.getByTestId("nav-badge-quotes")).toHaveText("2");

    for (const gone of [lost, archived]) {
      await page.goto(`/portal/quote/${gone.token}`);
      await expect(page.getByTestId("quote-not-found")).toBeVisible();
      const auth = { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("portal_token"))}` };
      expect((await page.request.get(`/api/v2/portal/quotes/${gone.token}`, { headers: auth })).status()).toBe(404);
      expect((await page.request.post(`/api/v2/portal/quotes/${gone.token}/action`, { headers: auth, data: { action: "interested" } })).status()).toBe(404);
      expect(await actionRows(gone.id)).toHaveLength(0);
    }

    // Home agrees with the list.
    await page.goto("/portal");
    await expect(page.getByRole("button", { name: "2 quotes to consider" })).toBeVisible();
  });

  test("a booked quote's link shows 'This holiday is booked' with a button to its booking; a non-owner still gets not-found", async ({ page }) => {
    const { q } = await fixture(page);
    const trip = await bookedDeal(page.request, q.world, { title: "Booked Barbados Week", travel_date: "2027-03-10", num_of_nights: 7, adult: 2 });
    const bookedToken = token();
    await queryRows(`update quote_table set quote_token = $1 where id = $2`, [bookedToken, trip.entityId]);

    await page.goto("/portal/quotes");
    await expect(page.locator(`[data-testid^="quote-card-"]`)).toHaveCount(2); // the booked one is not listed

    await page.goto(`/portal/quote/${bookedToken}`);
    const booked = page.getByTestId("quote-booked");
    await expect(booked).toBeVisible();
    await expect(booked).toContainText("This holiday");
    await expect(booked).toContainText("is booked.");
    await expect(page.getByTestId("quote-not-found")).toHaveCount(0);

    const auth = { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("portal_token"))}` };
    const detail = await page.request.get(`/api/v2/portal/quotes/${bookedToken}`, { headers: auth });
    expect(detail.status()).toBe(410);
    const [bookingRow] = await queryRows<{ id: string }>(`select id from booking_table where transaction_id = $1`, [trip.transactionId]);
    // The owner is told which booking it became (exactly one live booking on the deal).
    expect(await detail.json()).toEqual({ error: "This holiday is booked", code: "BOOKED", bookingId: bookingRow.id });
    expect((await page.request.post(`/api/v2/portal/quotes/${bookedToken}/action`, { headers: auth, data: { action: "interested" } })).status()).toBe(410);
    expect(await actionRows(trip.entityId)).toHaveLength(0);

    await expect(page.getByTestId("button-quote-booked-bookings")).toHaveText("View my booking");
    await page.getByTestId("button-quote-booked-bookings").click();
    await expect(page).toHaveURL(new RegExp(`/portal/booking/${bookingRow.id}$`));
    await expect(page.getByTestId("portal-booking")).toBeVisible();

    // Somebody else's customer gets the plain not-found answer.
    const other = await seedPortalCustomer();
    const login = await page.request.post("/api/v2/portal/login", { data: { email: other.email, pin: other.pin, org: other.slug } });
    const { token: otherToken } = (await login.json()) as { token: string };
    const theirs = await page.request.get(`/api/v2/portal/quotes/${bookedToken}`, { headers: { Authorization: `Bearer ${otherToken}` } });
    expect(theirs.status()).toBe(404);
    expect(await theirs.json()).toEqual({ error: "Quote not found" });
  });
});

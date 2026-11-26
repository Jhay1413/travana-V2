/**
 * Customer portal, Phase 4: Bookings (Trips > Bookings) and the booking screen in the new look. The booking is made
 * through the staff API and its itinerary is written to the practice database (see helpers/portal-bookings.ts);
 * everything is asserted through the real screens and the portal's own endpoints.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "../helpers/fixtures";
import { daysFromToday } from "../helpers/pipeline";
import { seedPortalCustomer, startSignedIn } from "../helpers/portal";
import { COST_MARKER, seedPortalBooking, type SeededPortalBooking } from "../helpers/portal-bookings";
import { seedPortalQuoteWorld, type PortalQuoteWorld } from "../helpers/portal-quotes";
import { queryRows } from "../helpers/seed";

interface Fixture {
  q: PortalQuoteWorld;
  /** 45 days away: flight pair, two hotels, a transfer, an extra and two photos. 2400 - 100 + 50 = £2,350.00. */
  upcoming: SeededPortalBooking;
  /** Travelled two months ago, no itinerary. £1,800.00. */
  past: SeededPortalBooking;
  /** LOST: must never appear. */
  lost: SeededPortalBooking;
}

async function fixture(page: Page): Promise<Fixture> {
  const q = await seedPortalQuoteWorld(page);
  const upcoming = await seedPortalBooking(page, q, { title: "Hotel Playa Azul Majorca", travelDate: 45, itinerary: true });
  const past = await seedPortalBooking(page, q, { title: "Algarve Golf Escape", travelDate: daysFromToday(-60), salesPrice: "1800.00", discounts: "0", serviceCharge: "0" });
  const lost = await seedPortalBooking(page, q, { title: "Dead Deal In Dubai", travelDate: 30, lost: true });
  await startSignedIn(page, q.portal);
  return { q, upcoming, past, lost };
}

const authHeaders = async (page: Page) => ({ Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("portal_token"))}` });
const scrollWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);
const bodyText = (page: Page) => page.evaluate(() => document.body.innerText);

test.describe("customer portal: bookings list", () => {
  test("lists an upcoming and a past booking with price and references, and leaves out a LOST one", async ({ page }) => {
    const { upcoming, past, lost } = await fixture(page);
    await page.goto("/portal/trips/bookings");

    await expect(page.getByTestId("portal-bookings")).toBeVisible();
    const card = page.getByTestId(`booking-card-${upcoming.id}`);
    await expect(card).toBeVisible();
    await expect(page.getByTestId(`booking-status-${upcoming.id}`)).toHaveText("45 days to go");
    await expect(page.getByTestId(`booking-price-${upcoming.id}`)).toHaveText("£2,350.00");
    await expect(card).toContainText("£1,175.00 per person");
    await expect(page.getByTestId(`booking-ref-${upcoming.id}`)).toContainText(upcoming.haysRef);
    await expect(card).toContainText("E2E Sun Holidays");
    await expect(card).toContainText("7 nights · All Inclusive · 2 adults");
    await expect(card).toContainText("View booking");
    await expect(card.locator("img").first()).toBeVisible();

    await expect(page.getByTestId("bookings-past")).toContainText("Where you've");
    const row = page.getByTestId(`booking-past-${past.id}`);
    await expect(row).toContainText("Algarve Golf Escape");
    await expect(row).toContainText("£1,800.00");
    await expect(page.getByTestId(`booking-past-ref-${past.id}`)).toContainText(past.haysRef);
    await expect(row).toContainText("Travelled");

    await expect(page.getByTestId(`booking-card-${lost.id}`)).toHaveCount(0);
    await expect(page.getByTestId(`booking-past-${lost.id}`)).toHaveCount(0);
    expect(await bodyText(page)).not.toContain("Dead Deal");
  });

  test("a card opens its booking, and a past row does too", async ({ page }) => {
    const { upcoming, past } = await fixture(page);
    await page.goto("/portal/trips/bookings");
    await page.getByTestId(`booking-card-${upcoming.id}`).click();
    await expect(page).toHaveURL(new RegExp(`/portal/booking/${upcoming.id}$`));
    await expect(page.getByTestId("portal-booking")).toBeVisible();
    await expect(page.getByTestId("nav-tab-trips")).toHaveAttribute("aria-current", "page");
    await page.goto("/portal/trips/bookings");
    await page.getByTestId(`booking-past-${past.id}`).click();
    await expect(page).toHaveURL(new RegExp(`/portal/booking/${past.id}$`));
    await expect(page.getByTestId("booking-countdown")).toHaveText("Travelled");
  });

  test("a booking whose status was never set is shown, one that is LOST is not (API and screen)", async ({ page }) => {
    const { q, upcoming, lost } = await fixture(page);
    const unset = await seedPortalBooking(page, q, { title: "No Status Yet", travelDate: 90, noStatus: true });
    await page.goto("/portal/trips/bookings");
    await expect(page.getByTestId(`booking-card-${unset.id}`)).toBeVisible();
    const headers = await authHeaders(page);
    const list = (await (await page.request.get("/api/v2/portal/bookings", { headers })).json()) as { id: string }[];
    expect(list.map((b) => b.id)).toContain(unset.id);
    expect(list.map((b) => b.id)).toContain(upcoming.id);
    expect(list.map((b) => b.id)).not.toContain(lost.id);
    expect((await page.request.get(`/api/v2/portal/bookings/${lost.id}`, { headers })).status()).toBe(404);
  });

  test("a booking on a TEST deal is not shown anywhere: list, detail or Home", async ({ page }) => {
    const { q } = await fixture(page);
    const testBooking = await seedPortalBooking(page, q, { title: "Staff Practice Trip", travelDate: 20 });
    await queryRows(`update transaction set is_test = true where id = $1`, [testBooking.transactionId]);
    await page.goto("/portal/trips/bookings");
    await expect(page.getByTestId("portal-bookings")).toBeVisible();
    await expect(page.getByTestId(`booking-card-${testBooking.id}`)).toHaveCount(0);
    expect(await bodyText(page)).not.toContain("Staff Practice Trip");
    const headers = await authHeaders(page);
    expect((await page.request.get(`/api/v2/portal/bookings/${testBooking.id}`, { headers })).status()).toBe(404);
    const list = (await (await page.request.get("/api/v2/portal/bookings", { headers })).json()) as { id: string }[];
    expect(list.map((b) => b.id)).not.toContain(testBooking.id);
    const summary = (await (await page.request.get("/api/v2/portal/summary", { headers })).json()) as { nextBooking: { id: string } | null };
    expect(summary.nextBooking?.id).not.toBe(testBooking.id);
    await page.goto("/portal");
    await expect(page.getByTestId("portal-home")).toBeVisible();
    expect(await bodyText(page)).not.toContain("Staff Practice Trip");
  });

  test("a customer with no bookings sees the empty state, with a way to Quotes and to the agent", async ({ page }) => {
    const c = await seedPortalCustomer();
    await startSignedIn(page, c);
    await page.goto("/portal/trips/bookings");
    await expect(page.getByTestId("bookings-empty")).toContainText("No holidays");
    await expect(page.getByTestId("button-bookings-message")).toContainText(/Message /);
    await page.getByTestId("button-bookings-quotes").click();
    await expect(page).toHaveURL(/\/portal\/trips\/quotes$/);
  });

  test("a failed load says so and Try again recovers", async ({ page }) => {
    const { upcoming } = await fixture(page);
    let fail = true;
    await page.route("**/api/v2/portal/bookings", async (route) => {
      if (fail) await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Failed to load bookings" }) });
      else await route.continue();
    });
    await page.goto("/portal/trips/bookings");
    await expect(page.getByTestId("bookings-error")).toBeVisible();
    fail = false;
    await page.getByTestId("button-bookings-retry").click();
    await expect(page.getByTestId(`booking-card-${upcoming.id}`)).toBeVisible();
  });
});

test.describe("customer portal: the booking screen", () => {
  test("shows the hero countdown, the facts with both references, the price and the journey in date order", async ({ page }) => {
    const { upcoming } = await fixture(page);
    await page.goto(`/portal/booking/${upcoming.id}`);

    await expect(page.getByTestId("booking-title")).toContainText(/Hotel Playa Azul\s+Majorca/);
    await expect(page.getByTestId("booking-countdown")).toContainText("45");
    await expect(page.getByTestId("booking-countdown")).toContainText("Days to go");

    const details = page.getByTestId("booking-details");
    await expect(details).toContainText("7 nights · All Inclusive");
    await expect(details).toContainText("2 adults");
    await expect(details).toContainText("E2E Sun Holidays");
    // Two references, two separate rows, the operator's named after the operator.
    await expect(details).toContainText("Booking reference");
    await expect(details).toContainText(upcoming.haysRef);
    await expect(details).toContainText("E2E Sun Holidays reference");
    await expect(details).toContainText(upcoming.supplierRef);

    await expect(page.getByTestId("booking-total")).toHaveText("£2,350.00");
    await expect(page.getByTestId("booking-per-person")).toHaveText("£1,175.00 per person");
    await expect(page.getByTestId("booking-disclaimer")).toHaveText("Prices include all applicable taxes and fees.");

    // Flight out, the transfer, the first hotel, the second hotel, the flight home, then the extra.
    const kinds = await page.locator('[data-testid^="journey-item-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")));
    expect(kinds).toEqual(["flight-out", "transfer", "hotel", "hotel", "flight-in", "extra"]);
    const journey = page.getByTestId("quote-journey");
    await expect(journey).toContainText("Palma airport to Hotel Playa Azul");
    await expect(journey).toContainText("Double sea view");
    await expect(journey).toContainText("Family suite");
    await expect(journey).toContainText("Two extra nights at Hotel Playa Azul");

    await expect(page.getByTestId("quote-photos")).toBeVisible();
    await expect(page.getByTestId("booking-agent")).toBeVisible();
    // A decision is not asked for here: no action bar, no interest form.
    await expect(page.getByTestId("quote-action-bar")).toHaveCount(0);
    await expect(page.getByTestId("button-interested")).toHaveCount(0);
  });

  test("never shows a cost, a commission, a staff note or the price of an extra", async ({ page }) => {
    const { upcoming } = await fixture(page);
    await page.goto(`/portal/booking/${upcoming.id}`);
    await expect(page.getByTestId("quote-journey")).toBeVisible();
    const text = await bodyText(page);
    for (const secret of [COST_MARKER, "98,765", "STAFF-ONLY", "222.22", "commission", "Commission"]) expect(text).not.toContain(secret);

    const res = await page.request.get(`/api/v2/portal/bookings/${upcoming.id}`, { headers: await authHeaders(page) });
    expect(res.status()).toBe(200);
    const raw = await res.text();
    for (const secret of [COST_MARKER, "STAFF-ONLY", "222.22"]) expect(raw).not.toContain(secret);
    const keys = new Set<string>();
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") {
        for (const [k, child] of Object.entries(v)) {
          keys.add(k);
          walk(child);
        }
      }
    };
    walk(JSON.parse(raw));
    for (const k of keys) expect(k, k).not.toMatch(/cost|commission|salesPrice|discount|serviceCharge|userId|clientId|transactionId|passenger|firstName|lastName|surname/i);
  });

  test("with the payments flag off there is no balance, paid amount, due date, document or passport text anywhere", async ({ page }) => {
    const { upcoming, past } = await fixture(page);
    const banned = /balance|\bpaid\b|\bdue\b|payments?\b|documents?\b|passports?\b|deposit/i;
    for (const url of ["/portal/trips/bookings", `/portal/booking/${upcoming.id}`, `/portal/booking/${past.id}`]) {
      await page.goto(url);
      await expect(page.getByTestId(url.includes("/booking/") ? "portal-booking" : "portal-bookings")).toBeVisible();
      expect(await bodyText(page), url).not.toMatch(banned);
    }
    await expect(page.getByTestId("booking-payments")).toHaveCount(0);
  });

  test("a past trip says Travelled and an away trip says You're away", async ({ page }) => {
    const { q, past } = await fixture(page);
    const away = await seedPortalBooking(page, q, { title: "Lake Garda Week", travelDate: daysFromToday(-2), nights: 7 });
    await page.goto(`/portal/booking/${past.id}`);
    await expect(page.getByTestId("booking-countdown")).toHaveText("Travelled");
    await page.goto(`/portal/booking/${away.id}`);
    await expect(page.getByTestId("booking-countdown")).toHaveText("You're away");
    await page.goto("/portal/trips/bookings");
    await expect(page.getByTestId(`booking-status-${away.id}`)).toHaveText("You're away now");
  });

  test("'Ask about this booking' opens Messages with the composer started", async ({ page }) => {
    const { upcoming } = await fixture(page);
    await page.goto(`/portal/booking/${upcoming.id}`);
    await page.getByTestId("button-ask-about-booking").click();
    await expect(page).toHaveURL(/\/portal\/messages\?about=/);
    await expect(page.getByTestId("input-message")).toHaveValue(`About Hotel Playa Azul Majorca (${upcoming.haysRef}): `);
  });

  test("another customer's booking id shows the not-found screen, and the API answers 404 (and 400 for a malformed id)", async ({ page }) => {
    const { upcoming } = await fixture(page);
    const other = await seedPortalCustomer();
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

    await page.goto(`/portal/booking/${upcoming.id}`);
    await expect(page.getByTestId("booking-not-found")).toBeVisible();
    await expect(page.getByTestId("booking-total")).toHaveCount(0);
    await page.getByTestId("button-back-to-bookings").click();
    await expect(page).toHaveURL(/\/portal\/trips\/bookings$/);

    const headers = { Authorization: `Bearer ${otherToken}` };
    expect((await page.request.get(`/api/v2/portal/bookings/${upcoming.id}`, { headers })).status()).toBe(404);
    expect((await page.request.get(`/api/v2/portal/bookings/00000000-0000-4000-8000-000000000000`, { headers })).status()).toBe(404);
    expect((await page.request.get(`/api/v2/portal/bookings/not-an-id`, { headers })).status()).toBe(400);
    expect((await page.request.get(`/api/v2/portal/bookings/${upcoming.id}`)).status()).toBe(401);
    const list = (await (await page.request.get("/api/v2/portal/bookings", { headers })).json()) as unknown[];
    expect(list).toHaveLength(0);
  });

  test("a signed-out visitor is sent to sign in and comes back to the booking", async ({ page }) => {
    const q = await seedPortalQuoteWorld(page);
    const b = await seedPortalBooking(page, q, { title: "Return Trip To Rome", travelDate: 50 });
    await page.goto(`/portal/booking/${b.id}`);
    await expect(page).toHaveURL(/\/portal\/login\?next=%2Fportal%2Fbooking%2F/);
  });
});

test.describe("customer portal: bookings at 360px", () => {
  test("a very long title and long references wrap: no sideways scrolling on the list or the booking", async ({ page }) => {
    const q = await seedPortalQuoteWorld(page);
    const long = await seedPortalBooking(page, q, {
      title: "Wolfeschlegelsteinhausenbergerdorffstrasse Grand Resort And Spa Majorca Premium Collection Suites",
      travelDate: 45,
      itinerary: true,
      haysRef: `HAY-${"7".repeat(40)}`,
      supplierRef: `OPERATOR-${"X".repeat(50)}`,
    });
    await startSignedIn(page, q.portal);
    await page.setViewportSize({ width: 360, height: 740 });

    await page.goto("/portal/trips/bookings");
    const card = page.getByTestId(`booking-card-${long.id}`);
    await expect(card).toBeVisible();
    expect(await scrollWidth(page)).toBeLessThanOrEqual(360);
    const cardBox = await card.boundingBox();
    expect(cardBox && cardBox.x >= 0 && cardBox.x + cardBox.width <= 360, `card box ${JSON.stringify(cardBox)}`).toBe(true);
    const seg = await page.getByTestId("trips-segment-bookings").boundingBox();
    expect(seg?.height ?? 0).toBeGreaterThanOrEqual(43.5);

    await page.goto(`/portal/booking/${long.id}`);
    const h1 = page.getByTestId("booking-title");
    await expect(h1).toBeVisible();
    const box = await h1.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 360, `title box ${JSON.stringify(box)}`).toBe(true);
    await expect(page.getByTestId("booking-details")).toContainText(long.haysRef);
    await expect(page.getByTestId("booking-details")).toContainText(long.supplierRef);
    expect(await scrollWidth(page)).toBeLessThanOrEqual(360);
    const ask = await page.getByTestId("button-ask-about-booking").boundingBox();
    expect(ask?.height ?? 0).toBeGreaterThanOrEqual(43.5);
    expect((ask?.x ?? 0) + (ask?.width ?? 0)).toBeLessThanOrEqual(360);
  });
});

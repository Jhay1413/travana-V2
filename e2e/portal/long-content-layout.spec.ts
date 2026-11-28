/**
 * Customer portal and public quote: long real-world values must never push a screen wider than the phone.
 *
 * The default seed names are short and the test browser draws fallback fonts, so a card that only overflows with a long
 * place, a long operator, a long unbroken name or a wide uppercase tracked line would pass. This spec seeds deliberately
 * long values (helpers/portal-quotes.ts LONG_NAMES) and checks every list and detail screen at 320, 360 and 390px:
 * the page does not scroll sideways, and no element in the page content has its right edge beyond the screen
 * (expectFitsViewport; horizontally scrolling rails are marked data-scroll-rail and skipped).
 */
import { randomBytes } from "node:crypto";
import type { Browser, Page } from "@playwright/test";
import { expect, test } from "../helpers/fixtures";
import { startSignedIn } from "../helpers/portal";
import { seedPortalBooking } from "../helpers/portal-bookings";
import { seedPortalFile, seedPortalPassenger } from "../helpers/portal-paperwork";
import { giveLongNames, LONG_NAMES, seedPortalQuote, seedPortalQuoteWorld, seedPublishedDeal } from "../helpers/portal-quotes";
import { queryRows } from "../helpers/seed";
import { expectFitsViewport } from "../helpers/ui";

const WIDTHS = [320, 360, 390] as const;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
/** A 20 character token, like the ones the app mints (the public link only opens those). */
const token = () => Array.from(randomBytes(20), (b) => ALPHABET[b % ALPHABET.length]).join("");
/** 60 characters, with spaces (a real hotel-style title). */
const LONG_TITLE = "Amsterdam Canal Houses and Tulip Fields Escape for Two Adults";

async function anonymousPage(browser: Browser, baseURL: string): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  return context.newPage();
}

async function longWorld(page: Page) {
  // The agent and the agency are named through the branding answer (the test agency has no real agent to name).
  await page.route("**/api/v2/portal/branding", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as Record<string, unknown>;
    await route.fulfill({ response: res, json: { ...body, agentName: `${LONG_NAMES.agent} Smith`, name: LONG_NAMES.agency } });
  });
  const q = await seedPortalQuoteWorld(page);
  await queryRows(`update client_table set "firstName" = $2, surename = $3 where id = $1`, [q.portal.clientId, LONG_NAMES.surname, LONG_NAMES.surname]);
  const open = await seedPortalQuote(page, q, { title: LONG_TITLE, token: token(), salesPrice: "1000.00", expiresInDays: 12, itinerary: true, rich: true });
  const second = await seedPortalQuote(page, q, { title: `${LONG_TITLE} Second`, token: token(), salesPrice: "1800.00", expiresInDays: 20, itinerary: true });
  const trip = await seedPortalBooking(page, q, { title: LONG_TITLE, travelDate: 45, itinerary: true });
  await giveLongNames({ quoteId: open.id, bookingId: trip.id });
  await giveLongNames({ quoteId: second.id });
  await seedPortalFile(q.portal.clientId, { name: LONG_NAMES.file, category: "Tickets", bookingId: trip.id, storage: "local" });
  await seedPortalPassenger(q.portal.clientId, { isLead: true, passportNumber: "531764821", passportExpiry: "2035-02-09" });
  await seedPortalPassenger(q.portal.clientId, { firstName: LONG_NAMES.surname, surname: LONG_NAMES.surname, dateOfBirth: "1990-03-03", passportNumber: "548193027", passportExpiry: "2035-02-09" });
  await seedPortalPassenger(q.portal.clientId, { firstName: LONG_NAMES.surname, surname: LONG_NAMES.surname, dateOfBirth: "1991-03-03" });
  await seedPublishedDeal(page, q, { title: LONG_TITLE, token: token(), forClientId: null });
  await startSignedIn(page, q.portal);
  return { q, open, trip };
}

test.describe("customer portal: long content never makes a screen scroll sideways", () => {
  // One test per width: nine screens each, so a single test would not fit the 60 second limit.
  for (const width of WIDTHS) test(`quotes list, quote, my bookings, booking, home, deals, rewards, messages and account at ${width}px`, async ({ page }) => {
    const { open, trip } = await longWorld(page);
    const screens: Array<{ name: string; path: string; ready: string }> = [
      { name: "Quotes list", path: "/portal/quotes", ready: "quotes-list" },
      { name: "Quote", path: `/portal/quote/${open.token}`, ready: "quote-agent" },
      { name: "My bookings", path: "/portal/bookings", ready: "portal-bookings" },
      { name: "Booking", path: `/portal/booking/${trip.id}`, ready: "booking-agent" },
      { name: "Home", path: "/portal", ready: "home-agent" },
      { name: "Deals", path: "/portal/deals", ready: "portal-deals" },
      { name: "Rewards", path: "/portal/referrals", ready: "portal-rewards" },
      { name: "Messages", path: "/portal/messages", ready: "portal-messages" },
      { name: "Account", path: "/portal/account", ready: "portal-account" },
    ];
    {
      await page.setViewportSize({ width, height: 740 });
      for (const screen of screens) {
        await page.goto(screen.path);
        await expect(page.getByTestId(screen.ready), `${screen.name} is on screen`).toBeVisible();
        if (screen.name === "Quotes list") await expect(page.getByTestId(/^quote-operator-/).first()).toContainText(LONG_NAMES.operator);
        if (screen.name === "Booking") {
          await expect(page.getByTestId("document-name").first()).toBeVisible();
          await expect(page.getByTestId("passenger-status")).toHaveCount(3);
          // The document row keeps both buttons whole next to the 128-character file name.
          for (const id of [/^document-view-/, /^document-download-/]) {
            const button = page.getByTestId(id).first();
            await expect(button).toBeVisible();
            const box = await button.boundingBox();
            expect(box, "document button has a box").not.toBeNull();
            expect((box?.x ?? -1) >= 0 && (box?.x ?? 0) + (box?.width ?? 0) <= width + 0.5, `document button inside the screen at ${width}px`).toBe(true);
            expect(await button.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), "document button text is not cut").toBe(true);
          }
        }
        await expectFitsViewport(page, width, screen.name);
      }
    }
  });

  test("the message sheet and the menu with a long agent name and long titles fit at 320, 360 and 390px", async ({ page }) => {
    await longWorld(page);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 740 });
      await page.goto("/portal");
      await expect(page.getByTestId("home-agent")).toBeVisible();
      await page.getByTestId("nav-tab-agent").click();
      await expect(page.getByTestId("sheet-message")).toBeVisible();
      await expect(page.getByTestId("message-about").getByRole("radio").first()).toBeVisible();
      await expectFitsViewport(page, width, "Message sheet");
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("sheet-message")).toHaveCount(0);
    }
  });

  test("a public quote link with the long values fits at 320, 360 and 390px", async ({ page, browser, baseURL }) => {
    const { open } = await longWorld(page);
    // An anonymous visitor: a fresh browser context (no portal session), as the other public-link specs do.
    const visitor = await anonymousPage(browser, baseURL ?? "");
    for (const width of WIDTHS) {
      await visitor.setViewportSize({ width, height: 740 });
      await visitor.goto(`/view-quote/${open.token}`);
      await expect(visitor.getByTestId("quote-agent")).toBeVisible();
      await expectFitsViewport(visitor, width, "Public quote");
    }
    await visitor.context().close();
  });
});

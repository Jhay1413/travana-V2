/**
 * Customer portal and public quote: long real-world values must never push a screen wider than the phone. WRITTEN, NOT
 * RUN (the practice database was unavailable).
 *
 * The default seed names are short and the test browser draws fallback fonts, so a card that only overflows with a long
 * place, a long operator, a long unbroken name or a wide uppercase tracked line would pass. This spec seeds deliberately
 * long values (helpers/portal-quotes.ts LONG_NAMES) and checks every list and detail screen at 320, 360 and 390px:
 * the page does not scroll sideways, and no element in the page content has its right edge beyond the screen
 * (expectFitsViewport; horizontally scrolling rails are marked data-scroll-rail and skipped).
 */
import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "../helpers/fixtures";
import { startSignedIn } from "../helpers/portal";
import { seedPortalBooking } from "../helpers/portal-bookings";
import { seedPortalFile, seedPortalPassenger } from "../helpers/portal-paperwork";
import { giveLongNames, LONG_NAMES, seedPortalQuote, seedPortalQuoteWorld, seedPublishedDeal } from "../helpers/portal-quotes";
import { queryRows } from "../helpers/seed";
import { expectFitsViewport } from "../helpers/ui";

const WIDTHS = [320, 360, 390] as const;
const token = () => randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
/** 60 characters, with spaces (a real hotel-style title). */
const LONG_TITLE = "Amsterdam Canal Houses and Tulip Fields Escape for Two Adults";

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
  await seedPortalQuote(page, q, { title: `${LONG_TITLE} Second`, token: token(), salesPrice: "1800.00", expiresInDays: 20, itinerary: true });
  const trip = await seedPortalBooking(page, q, { title: LONG_TITLE, travelDate: 45, itinerary: true });
  await giveLongNames({ quoteId: open.id, bookingId: trip.id });
  await seedPortalFile(q.portal.clientId, { name: LONG_NAMES.file, category: "Tickets", bookingId: trip.id });
  await seedPortalPassenger(q.portal.clientId, { isLead: true, passportNumber: "531764821", passportExpiry: "2035-02-09" });
  await seedPortalPassenger(q.portal.clientId, { firstName: LONG_NAMES.surname, surname: LONG_NAMES.surname, dateOfBirth: "1990-03-03", passportNumber: "548193027", passportExpiry: "2035-02-09" });
  await seedPortalPassenger(q.portal.clientId, { firstName: LONG_NAMES.surname, surname: LONG_NAMES.surname, dateOfBirth: "1991-03-03" });
  await seedPublishedDeal(page, q, { title: LONG_TITLE, token: token(), forClientId: null });
  await startSignedIn(page, q.portal);
  return { q, open, trip };
}

test.describe("customer portal: long content never makes a screen scroll sideways", () => {
  test("quotes list, quote, my bookings, booking, home, deals, rewards, messages and account at 320, 360 and 390px", async ({ page }) => {
    const { open, trip } = await longWorld(page);
    const screens: Array<{ name: string; path: string; ready: string }> = [
      { name: "Quotes list", path: "/portal/quotes", ready: "quotes-list" },
      { name: "Quote", path: `/portal/quote/${open.token}`, ready: "quote-agent" },
      { name: "My bookings", path: "/portal/bookings", ready: "portal-bookings" },
      { name: "Booking", path: `/portal/booking/${trip.id}`, ready: "booking-agent" },
      { name: "Home", path: "/portal", ready: "home-agent" },
      { name: "Deals", path: "/portal/deals", ready: "portal-deals" },
      { name: "Rewards", path: "/portal/rewards", ready: "portal-rewards" },
      { name: "Messages", path: "/portal/messages", ready: "portal-messages" },
      { name: "Account", path: "/portal/account", ready: "portal-account" },
    ];
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 740 });
      for (const screen of screens) {
        await page.goto(screen.path);
        await expect(page.getByTestId(screen.ready), `${screen.name} is on screen`).toBeVisible();
        if (screen.name === "Quotes list") await expect(page.getByTestId(/^quote-operator-/).first()).toContainText(LONG_NAMES.operator);
        if (screen.name === "Booking") await expect(page.getByTestId("document-name").first()).toBeVisible();
        if (screen.name === "Booking") await expect(page.getByTestId("passenger-status")).toHaveCount(3);
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

  test("a public quote link with the long values fits at 320, 360 and 390px", async ({ page }) => {
    const { open } = await longWorld(page);
    await page.evaluate(() => localStorage.clear());
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 740 });
      await page.goto(`/view-quote/${open.token}`);
      await expect(page.getByTestId("quote-agent")).toBeVisible();
      await expectFitsViewport(page, width, "Public quote");
    }
  });
});

/**
 * TEMPORARY: saves screenshots of the customer portal for a design check by eye. Not a real test (it asserts
 * almost nothing). Delete this file once the screenshots have been looked at.
 */
import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test } from "../helpers/fixtures";
import { startSignedIn } from "../helpers/portal";
import { seedPortalQuote, seedPortalQuoteWorld, seedPublishedDeal, tagDealWithInterest } from "../helpers/portal-quotes";
import { bookedDeal, daysFromToday } from "../helpers/pipeline";
import { seedPortalBooking } from "../helpers/portal-bookings";

const OUT = "C:\\Users\\admin\\AppData\\Local\\Temp\\claude\\51484a1d8a319d29\\62e5945d-3189-4988-bee1-ddad4fec3fa2\\scratchpad\\portal-shots";
const token = () => randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
const SIZES = [
  { name: "390", width: 390, height: 844 },
  { name: "1280", width: 1280, height: 900 },
] as const;

async function settle(page: Page) {
  await page.waitForTimeout(700); // the page fades in; fonts fall back (outbound requests are blocked)
}

for (const size of SIZES) {
  test(`TEMPORARY screenshots at ${size.name}px`, async ({ page }) => {
    test.setTimeout(180_000);
    mkdirSync(OUT, { recursive: true });
    const shot = async (name: string, fullPage = true) => {
      await settle(page);
      await page.screenshot({ path: path.join(OUT, `${size.name}-${name}.png`), fullPage });
    };
    await page.setViewportSize({ width: size.width, height: size.height });

    const q = await seedPortalQuoteWorld(page);
    const rich = await seedPortalQuote(page, q, {
      title: "Hotel Playa Azul Majorca", token: token(), salesPrice: "2400.00", discounts: "100.00", serviceCharge: "50.00",
      expiresInDays: 12, itinerary: true, rich: true,
    });
    const declined = await seedPortalQuote(page, q, { title: "Tenerife Sun Break", token: token(), salesPrice: "1000.00", expiresInDays: 20 });
    const interested = await seedPortalQuote(page, q, { title: "Algarve Golf Escape", token: token(), salesPrice: "1800.00", expiresInDays: 5 });

    // A holiday 40 days away and a deal that matches the customer's interest, so Home shows its journey and deals.
    await bookedDeal(page.request, q.world, { title: "Cretan Villa Week", travel_date: daysFromToday(40), num_of_nights: 7, adult: 2, child: 1 });
    // Bookings: one coming up with a flight pair, two hotels, a transfer and an extra, and one that has been travelled.
    const trip = await seedPortalBooking(page, q, { title: "Hotel Playa Azul Majorca", travelDate: 45, itinerary: true });
    const later = await seedPortalBooking(page, q, { title: "Lisbon City Break", travelDate: 120, salesPrice: "900.00", discounts: "0", serviceCharge: "0" });
    await seedPortalBooking(page, q, { title: "Algarve Golf Escape", travelDate: daysFromToday(-60), salesPrice: "1800.00", discounts: "0", serviceCharge: "0" });
    const deal = await seedPublishedDeal(page, q, { title: "Cyprus Beach Deal", token: token(), forClientId: null, salesPrice: "899.00" });
    await tagDealWithInterest(deal.id, q.portal.tagName);

    // 1. Login page (signed out), by agency.
    await page.goto(`/portal/login?org=${q.portal.slug}`);
    await expect(page.getByTestId("input-email")).toBeVisible();
    await shot("01-login");

    await startSignedIn(page, q.portal);
    const auth = async () => ({ Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("portal_token"))}` });

    // 2. Home.
    await page.goto("/portal");
    await expect(page.getByTestId("nav-bottom")).toBeVisible();
    await expect(page.getByTestId("portal-home")).toBeVisible();
    await expect(page.getByTestId("home-quotes")).toBeVisible();
    await shot("02-home");
    await page.getByTestId("button-request-quote").click();
    await expect(page.getByTestId("sheet-request-quote")).toBeVisible();
    await shot("02b-home-request-sheet", false);
    await page.keyboard.press("Escape");

    // One interested, one declined (through the portal's own endpoint), then the list.
    const headers = await auth();
    await page.request.post(`/api/v2/portal/quotes/${interested.token}/action`, { headers, data: { action: "interested", note: "Lovely" } });
    await page.request.post(`/api/v2/portal/quotes/${declined.token}/action`, { headers, data: { action: "declined", reason: "Too expensive", wantsSimilar: true } });
    await page.goto("/portal/quotes");
    await expect(page.getByTestId(`quote-card-${rich.id}`)).toBeVisible();
    await expect(page.getByTestId(`declined-row-${declined.id}`)).toBeVisible();
    await shot("03-quotes-list");

    // 3. Quote detail: as loaded, scrolled to the journey.
    await page.goto(`/portal/quote/${rich.token}`);
    await expect(page.getByTestId("quote-journey")).toBeVisible();
    await shot("04-quote-top", false);
    await shot("04b-quote-full");
    await page.getByTestId("quote-journey").scrollIntoViewIfNeeded();
    await shot("05-quote-journey", false);

    // 4. Sheets.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByTestId("button-not-interested").click();
    await expect(page.getByTestId("sheet-decline")).toBeVisible();
    await page.getByTestId("chip-reason-1").click();
    await shot("06-not-interested-sheet", false);
    await page.keyboard.press("Escape");
    await page.getByTestId("button-share").click();
    await expect(page.getByTestId("sheet-share")).toBeVisible();
    await shot("07-share-sheet", false);
    await page.keyboard.press("Escape");

    // 5. Thank-you state.
    await page.getByTestId("input-interest-note").fill("A sea view, perhaps");
    await page.getByTestId("button-interested-submit").click();
    await expect(page.getByTestId("quote-thanks")).toBeVisible();
    await page.getByTestId("quote-thanks").scrollIntoViewIfNeeded();
    await shot("08-thank-you", false);

    // 6. Other tabs.
    await page.goto("/portal/bookings");
    await expect(page.getByTestId("nav-bottom")).toBeVisible();
    // My bookings: the next holiday in full, then the other holidays and the ones already travelled.
    await expect(page.getByTestId("portal-booking")).toBeVisible();
    await shot("09-my-bookings", false);
    await shot("09b-my-bookings-full");
    await expect(page.getByTestId(`booking-other-${later.id}`)).toBeVisible();
    await page.getByTestId("bookings-others").scrollIntoViewIfNeeded();
    await shot("09f-other-holidays", false);
    await page.goto(`/portal/booking/${trip.id}`);
    await expect(page.getByTestId("quote-journey")).toBeVisible();
    await shot("09c-booking-top", false);
    await shot("09d-booking-full");
    await page.getByTestId("quote-journey").scrollIntoViewIfNeeded();
    await shot("09e-booking-journey", false);
    await page.goto("/portal/account");
    await expect(page.getByTestId("portal-account")).toBeVisible();
    await shot("10-account");

    // 7. The five-tab bar, the menu and the Message sheet (form, then sent).
    await page.goto("/portal");
    await expect(page.getByTestId("portal-home")).toBeVisible();
    await settle(page);
    await page.getByTestId("nav-bottom").screenshot({ path: path.join(OUT, `${size.name}-20-tab-bar.png`) });
    await page.getByTestId("button-portal-menu").click();
    await expect(page.getByTestId("portal-menu")).toBeVisible();
    await shot("21-menu", false);
    await page.getByTestId("menu-message-agent").click();
    await expect(page.getByTestId("sheet-message")).toBeVisible();
    await shot("22-message-sheet-form", false);
    await page.getByTestId("message-extra-airport-parking").click();
    await page.getByTestId("message-text").fill("It is our anniversary, could we have a sea view?");
    await page.getByTestId("message-send").click();
    await expect(page.getByTestId("message-sent")).toBeVisible();
    await shot("23-message-sheet-sent", false);
    await page.keyboard.press("Escape");
    await page.getByTestId("nav-tab-agent").click();
    await expect(page.getByTestId("sheet-message")).toBeVisible();
    await page.getByTestId("nav-bottom").screenshot({ path: path.join(OUT, `${size.name}-24-tab-bar-sheet-open.png`) });
    await page.keyboard.press("Escape");
    await page.goto("/portal/messages");
    await expect(page.getByTestId("input-message")).toBeVisible();
    await shot("11-messages");
  });
}

// ── Deals, Messages, Rewards, Interests and the set-up wizard (added with their redesign) ──────────────────────────
import { seedPortalCustomer } from "../helpers/portal";
import { seedAgentMessage, seedReferral, seedWalletCredit, setVipTier, signInAs, tagDealWith } from "../helpers/portal-screens";

test.describe("TEMPORARY screenshots: deals, messages, rewards, interests, set-up wizard", () => {
  for (const size of SIZES) {
    test(`TEMPORARY screenshots of the remaining screens at ${size.name}px`, async ({ page }) => {
      test.setTimeout(180_000);
      mkdirSync(OUT, { recursive: true });
      const shot = async (name: string, fullPage = true) => {
        await settle(page);
        await page.screenshot({ path: path.join(OUT, `${size.name}-${name}.png`), fullPage });
      };
      await page.setViewportSize({ width: size.width, height: size.height });

      const q = await seedPortalQuoteWorld(page);
      const beach = await seedPublishedDeal(page, q, { title: "Cyprus Beach Deal", token: token(), forClientId: null, salesPrice: "899.00" });
      await tagDealWithInterest(beach.id, q.portal.tagName);
      const golf = await seedPublishedDeal(page, q, { title: "Algarve Golf Deal", token: token(), forClientId: null, salesPrice: "1250.00" });
      await tagDealWith(golf.id, "Golf");
      await seedAgentMessage(q.portal.clientId, "Welcome back. Have a look at the new quote.", "Sam Agent", 3 * 24 * 60);
      await seedAgentMessage(q.portal.clientId, "Anything you would like changed?", "Sam Agent", 5);
      await setVipTier(q.portal.clientId, "standard");
      const friend = await seedReferral(q.portal.clientId, { name: "Sam Friend", status: "IN_WALLET", payout: "25.00", email: "sam.friend@example.test" });
      await seedReferral(q.portal.clientId, { name: "Pending Pat", status: "PENDING", payout: "40.00" });
      await seedReferral(q.portal.clientId, { name: "Paid Pam", status: "PAID", payout: "30.00" });
      await seedWalletCredit(q.portal.clientId, "25.00", friend.id);
      await startSignedIn(page, q.portal);

      // Deals: Latest (interest-matched), a tag chosen, For you.
      await page.goto("/portal/deals");
      await expect(page.getByTestId(`card-deal-${beach.id}`)).toBeVisible();
      await shot("12-deals");
      await page.getByTestId("chip-matching-interests").click();
      await expect(page.getByTestId(`card-deal-${golf.id}`)).toBeVisible();
      await shot("12b-deals-all");
      await page.getByTestId(`button-interest-${beach.id}`).click();
      await expect(page.getByTestId(`deal-told-${beach.id}`)).toBeVisible();
      await shot("12c-deals-told");
      await page.goto("/portal/deals?tab=for-you");
      await expect(page.getByTestId(`card-deal-${beach.id}`)).toBeVisible();
      await shot("12d-deals-for-you");

      // Messages.
      await page.goto("/portal/messages");
      await expect(page.getByTestId("message-log")).toContainText("Anything you would like changed?");
      await page.getByTestId("input-message").fill("Could we look at a week in October instead?");
      await page.getByTestId("button-send-message").click();
      await expect(page.getByTestId("message-log")).toContainText("a week in October");
      await shot("13-messages", false);

      // Rewards: referrals, a referral opened, the wallet, the withdrawal sheet.
      await page.goto("/portal/referrals");
      await expect(page.getByTestId("rewards-referrals")).toBeVisible();
      await page.getByTestId(`button-referral-${friend.id}`).click();
      await shot("14-rewards-referrals");
      await page.getByTestId("tab-rewards-wallet").click();
      await expect(page.getByTestId("wallet-balance")).toHaveText("£25.00");
      await shot("15-rewards-wallet");
      await page.getByTestId("button-open-withdraw").click();
      await expect(page.getByTestId("sheet-withdraw")).toBeVisible();
      await page.getByTestId("input-account-name").fill("A Customer");
      await shot("16-withdraw-sheet", false);
      await page.keyboard.press("Escape");

      // Set-up wizard (opened the way Account opens it).
      await page.goto("/portal/account");
      await expect(page.getByTestId("portal-account")).toBeVisible();
      await page.evaluate(() => window.dispatchEvent(new Event("portal:open-setup-wizard")));
      await expect(page.getByTestId("setup-wizard")).toBeVisible();
      await shot("17-setup-wizard", false);
      await page.keyboard.press("Escape");

      // Interests: editing (from Account), then a first-time customer.
      await page.goto("/portal/tags");
      await expect(page.getByTestId("portal-interests")).toBeVisible();
      await shot("18-interests-edit", false);
      const fresh = await seedPortalCustomer({ withInterest: false });
      await signInAs(page, fresh);
      await page.goto("/portal/tags");
      await expect(page.getByTestId("portal-interests")).toBeVisible();
      await shot("19-interests-first", false);
    });
  }
});

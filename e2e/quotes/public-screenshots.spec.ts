/**
 * TEMPORARY: saves screenshots of the public quote page (/view-quote/:token) for a design check by eye. Not a real test
 * (it asserts almost nothing). WRITTEN, NOT RUN. Delete this file once the screenshots have been looked at.
 *
 * Saves, at 390x844 and 1280x900 (full page): the open quote, the expired quote, the booked and unavailable screens,
 * the share sheet and the photo gallery, as `390-30-<name>.png` / `1280-30-<name>.png`.
 */
import { randomBytes } from "node:crypto";
import path from "node:path";
import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test } from "../helpers/fixtures";
import { bookedDeal, markLost } from "../helpers/pipeline";
import { seedPortalQuote, seedPortalQuoteWorld } from "../helpers/portal-quotes";
import { queryRows } from "../helpers/seed";

const OUT = "C:\\Users\\admin\\AppData\\Local\\Temp\\claude\\51484a1d8a319d29\\62e5945d-3189-4988-bee1-ddad4fec3fa2\\scratchpad\\portal-shots";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const newToken = () => Array.from(randomBytes(20), (b) => ALPHABET[b % ALPHABET.length]).join("");
const SIZES = [
  { name: "390", width: 390, height: 844 },
  { name: "1280", width: 1280, height: 900 },
] as const;

async function settle(page: Page) {
  await page.waitForTimeout(700); // fonts fall back (outbound requests are blocked)
}

for (const size of SIZES) {
  test(`TEMPORARY public quote screenshots at ${size.name}px`, async ({ page, browser, baseURL }) => {
    test.setTimeout(240_000);
    mkdirSync(OUT, { recursive: true });
    const w = await seedPortalQuoteWorld(page);

    const open = await seedPortalQuote(page, w, { title: "Hotel Playa Azul Majorca", token: newToken(), salesPrice: "2400.00", discounts: "100.00", serviceCharge: "50.00", itinerary: true, rich: true });
    const expired = await seedPortalQuote(page, w, { title: "Expired Estoril Escape", token: newToken(), salesPrice: "1800.00", itinerary: true, rich: true });
    await queryRows(`update quote_table set date_expiry = now() - interval '5 days' where id = $1`, [expired.id]);
    const trip = await bookedDeal(page.request, w.world, { title: "Booked Barbados Week", travel_date: "2027-03-10", num_of_nights: 7, adult: 2 });
    const bookedToken = newToken();
    await queryRows(`update quote_table set quote_token = $1 where id = $2`, [bookedToken, trip.entityId]);
    const lost = await seedPortalQuote(page, w, { title: "Lost Lisbon", token: newToken() });
    const lostDeal = await queryRows<{ transaction_id: string }>(`select transaction_id from quote_table where id = $1`, [lost.id]);
    await markLost(page.request, lostDeal[0].transaction_id);

    const context = await browser.newContext({ baseURL, viewport: { width: size.width, height: size.height } });
    const visitor = await context.newPage();
    const shot = async (name: string, fullPage = true) => {
      await settle(visitor);
      await visitor.screenshot({ path: path.join(OUT, `${size.name}-30-${name}.png`), fullPage });
    };

    await visitor.goto(`/view-quote/${open.token}`);
    await expect(visitor.getByTestId("page-public-quote")).toBeVisible();
    await shot("public-quote");

    await visitor.getByTestId("button-share").click();
    await expect(visitor.getByTestId("sheet-share")).toBeVisible();
    await shot("public-share-sheet", false);
    await visitor.keyboard.press("Escape");

    const viewAll = visitor.getByTestId("button-view-all-photos");
    if ((await viewAll.count()) > 0) {
      await viewAll.click();
      await expect(visitor.getByTestId("quote-gallery")).toBeVisible();
      await shot("public-gallery", false);
      await visitor.getByTestId("gallery-photo-0").click();
      await expect(visitor.getByTestId("quote-photo-viewer")).toBeVisible();
      await shot("public-viewer", false);
    }

    await visitor.goto(`/view-quote/${expired.token}`);
    await expect(visitor.getByTestId("banner-quote-expired")).toBeVisible();
    await shot("public-expired");

    await visitor.goto(`/view-quote/${bookedToken}`);
    await expect(visitor.getByTestId("blocked-quote-booked")).toBeVisible();
    await shot("public-booked");

    await visitor.goto(`/view-quote/${lost.token}`);
    await expect(visitor.getByTestId("blocked-quote-unavailable")).toBeVisible();
    await shot("public-unavailable");

    await context.close();
  });
}

/**
 * TEMPORARY: saves screenshots of the portal's documents, passports and checklist sections, the passport scanner's camera and
 * review steps, and the Home passport card, for a design check by eye. Not a real test. WRITTEN, NOT RUN. The read endpoint is
 * stubbed with page.route (a real AI provider is never called). Delete this file once the screenshots have been looked at.
 * (The Home card shows only once it is mounted in the Home screen; until then the Home shot simply has no card.)
 */
import path from "node:path";
import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test } from "../helpers/fixtures";
import { startSignedIn } from "../helpers/portal";
import { seedPortalBooking } from "../helpers/portal-bookings";
import { PASSPORT_PHOTO, seedPortalFile, seedPortalPassenger, stubPassportRead } from "../helpers/portal-paperwork";
import { seedPortalQuoteWorld } from "../helpers/portal-quotes";

const OUT = "C:\\Users\\admin\\AppData\\Local\\Temp\\claude\\51484a1d8a319d29\\62e5945d-3189-4988-bee1-ddad4fec3fa2\\scratchpad\\portal-shots";
const SIZES = [
  { name: "390", width: 390, height: 844 },
  { name: "1280", width: 1280, height: 900 },
] as const;

async function settle(page: Page) {
  await page.waitForTimeout(700); // the page fades in; fonts fall back (outbound requests are blocked)
}

for (const size of SIZES) {
  test(`TEMPORARY screenshots of documents and passports at ${size.name}px`, async ({ page }) => {
    test.setTimeout(180_000);
    mkdirSync(OUT, { recursive: true });
    const file = (name: string) => path.join(OUT, `${size.name}-20-${name}.png`);
    await page.setViewportSize({ width: size.width, height: size.height });

    const q = await seedPortalQuoteWorld(page);
    const trip = await seedPortalBooking(page, q, { title: "Hard Rock Hotel Tenerife", travelDate: 45, itinerary: true });
    await seedPortalFile(q.portal.clientId, { name: "confirmation.pdf", title: "Booking confirmation", category: "Tickets", size: 240_000, bookingId: trip.id });
    await seedPortalFile(q.portal.clientId, { name: "insurance.pdf", title: "Travel insurance certificate", category: "Insurance", size: 1_400_000, bookingId: trip.id });
    // The lead has a passport; the second traveller has none.
    await seedPortalPassenger(q.portal.clientId, { isLead: true, passportNumber: "531764821", passportExpiry: "2031-02-09", passportIssueDate: "2021-02-09", nationality: "British Citizen", sex: "M" });
    await seedPortalPassenger(q.portal.clientId, { firstName: "Emma", surname: "Bouy", dateOfBirth: "1990-03-03" });
    await stubPassportRead(page);
    await startSignedIn(page, q.portal);

    // The three sections on the bookings screen.
    await page.goto(`/portal/booking/${trip.id}`);
    await expect(page.getByTestId("booking-documents")).toContainText("Booking confirmation");
    await expect(page.getByTestId("booking-passports")).toContainText("Emma Bouy");
    await expect(page.getByTestId("booking-checklist")).toBeVisible();
    await settle(page);
    await page.getByTestId("booking-documents").screenshot({ path: file("documents") });
    await page.getByTestId("booking-passports").screenshot({ path: file("passports") });
    await page.getByTestId("booking-checklist").screenshot({ path: file("checklist") });
    await page.screenshot({ path: file("booking-full"), fullPage: true });

    // The scanner: camera step, then (photo chosen, read stubbed) the review step.
    // The first "Add passport" button on the page is the second traveller's (the lead's passport is saved).
    await page.locator('[data-testid^="passenger-add-"]').first().click();
    await expect(page.getByTestId("scanner-camera")).toBeVisible();
    await settle(page);
    await page.screenshot({ path: file("scanner-camera"), fullPage: false });
    await page.getByTestId("scanner-upload-input").setInputFiles(PASSPORT_PHOTO);
    await expect(page.getByTestId("scanner-review")).toBeVisible();
    await settle(page);
    await page.screenshot({ path: file("scanner-review"), fullPage: false });
    await page.getByTestId("passport-scanner").evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await settle(page);
    await page.screenshot({ path: file("scanner-review-bottom"), fullPage: false });
    await page.keyboard.press("Escape");

    // Home (the passport card shows here once it is mounted in the Home screen).
    await page.goto("/portal");
    await expect(page.getByTestId("portal-home")).toBeVisible();
    await settle(page);
    await page.screenshot({ path: file("home"), fullPage: true });
    const card = page.getByTestId("home-passport-card");
    if (await card.count()) await card.screenshot({ path: file("home-passport-card") });
  });
}

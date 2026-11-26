/**
 * Customer portal: "Passports / Snap it, we'll read it." and the photo scanner on the booking screen. WRITTEN, NOT RUN
 * (another process was using the practice database). Passengers are written to the practice database
 * (helpers/portal-paperwork.ts); the passport READ endpoint is always stubbed with page.route, never a real AI provider;
 * saving goes through the real portal endpoints.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "../helpers/fixtures";
import { seedPortalCustomer, startSignedIn } from "../helpers/portal";
import { seedPortalBooking, type SeededPortalBooking } from "../helpers/portal-bookings";
import { PASSPORT_PHOTO, recordPortalBodies, seedPortalPassenger, stubPassportRead, stubPassportReadFailure } from "../helpers/portal-paperwork";
import { seedPortalQuoteWorld, type PortalQuoteWorld } from "../helpers/portal-quotes";
import { queryRows } from "../helpers/seed";

const LEAD_NUMBER = "531764821";
const EMMA_NUMBER = "548193027";

interface Fixture {
  q: PortalQuoteWorld;
  trip: SeededPortalBooking;
  /** The traveller who has no passport yet. */
  emmaId: string;
}

/** A booking 45 days away; the lead has a passport (expires 9 Feb 2035), Emma has none. */
async function fixture(page: Page): Promise<Fixture> {
  const q = await seedPortalQuoteWorld(page);
  const trip = await seedPortalBooking(page, q, { title: "Hotel Playa Azul Majorca", travelDate: 45 });
  await seedPortalPassenger(q.portal.clientId, { isLead: true, passportNumber: LEAD_NUMBER, passportExpiry: "2035-02-09", passportIssueDate: "2025-02-09", nationality: "British Citizen", sex: "M" });
  const emmaId = await seedPortalPassenger(q.portal.clientId, { firstName: "Emma", surname: "Bouy", dateOfBirth: "1990-03-03" });
  await startSignedIn(page, q.portal);
  return { q, trip, emmaId };
}

const authHeaders = async (page: Page) => ({ Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("portal_token"))}` });
const scanner = (page: Page) => page.getByTestId("passport-scanner");
const field = (page: Page, name: string) => page.getByTestId(`scanner-field-${name}`);

async function photoInto(page: Page): Promise<void> {
  await page.getByTestId("scanner-upload-input").setInputFiles(PASSPORT_PHOTO);
}

test.describe("customer portal: passports", () => {
  test("shows a block per traveller: the lead's saved passport (last four only) and Emma's 'Needed'", async ({ page }) => {
    const { trip, emmaId } = await fixture(page);
    await page.goto(`/portal/booking/${trip.id}`);
    const section = page.getByTestId("booking-passports");
    await expect(section).toContainText("Passports");
    await expect(section).toContainText("Snap it,");
    await expect(section).toContainText("we'll read it.");
    await expect(section).toContainText("Take a photo of the photo page of each passport.");

    const blocks = section.locator('[data-testid^="passenger-"][data-testid*="-"]').filter({ has: page.getByTestId("passenger-name") });
    await expect(blocks).toHaveCount(2);
    await expect(blocks.nth(0)).toContainText("Lead passenger");
    // The lead is the customer themselves (the world's client has a generated name).
    await expect(blocks.nth(0).getByTestId("passenger-name")).toHaveText(/S/);
    await expect(blocks.nth(0).getByTestId("passenger-status")).toHaveText("✓ Added");
    await expect(blocks.nth(0).getByTestId("passenger-passport")).toContainText("•••••4821");
    await expect(blocks.nth(0).getByTestId("passenger-passport")).toContainText("9 Feb 2035");
    await expect(blocks.nth(0).getByTestId("passenger-passport")).toContainText("British Citizen");
    await expect(blocks.nth(0).getByTestId("passenger-check")).toContainText("Valid");

    const emma = page.getByTestId(`passenger-${emmaId}`);
    await expect(emma).toContainText("Traveller 2");
    await expect(emma).toContainText("Emma Bouy");
    await expect(emma.getByTestId("passenger-status")).toHaveText("Needed");
    await expect(emma).toContainText(/We still need this passport before .+ can finish your booking\./);
    await expect(page.getByTestId(`passenger-add-${emmaId}`)).toHaveText("Add passport");
    await expect(page.getByTestId("passenger-add-another")).toHaveText("Add another traveller");
    await expect(page.getByTestId("passports-lock-note")).toHaveText(
      "Your passport details are stored securely and only shared with your tour operator and the airline for this booking.",
    );

    // The checklist follows: one of two passports is in.
    await expect(page.getByTestId("checklist-passports")).toContainText("1 of 2 added. Add the rest above");
    await expect(page.getByTestId("checklist-status-passports")).toHaveText("To do");
  });

  test("add a passport by photo: read (stubbed), correct a field, save; the row shows the last four and the check sentence, never the full number", async ({ page }) => {
    const { trip, emmaId } = await fixture(page);
    const read = await stubPassportRead(page);
    const seen = recordPortalBodies(page);
    await page.goto(`/portal/booking/${trip.id}`);

    await page.getByTestId(`passenger-add-${emmaId}`).click();
    await expect(scanner(page)).toBeVisible();
    await expect(scanner(page)).toContainText("The photo page,");
    await expect(scanner(page)).toContainText("flat and clear.");
    await expect(page.getByTestId("scanner-camera-input")).toHaveAttribute("capture", "environment");
    await expect(scanner(page)).not.toContainText(/sample passport/i);

    await photoInto(page);
    await expect(page.getByTestId("scanner-reading")).toBeVisible();
    await expect(page.getByTestId("scanner-review")).toBeVisible();
    expect(read.calls()).toBe(1);
    await expect(scanner(page)).toContainText("Does this");
    await expect(scanner(page)).toContainText("look right?");
    await expect(field(page, "surname")).toHaveValue("BOUY");
    await expect(field(page, "givenNames")).toHaveValue("EMMA");
    await expect(field(page, "dateOfBirth")).toHaveValue("3 Mar 1990");
    await expect(field(page, "sex")).toHaveValue("F");
    await expect(field(page, "passportNumber")).toHaveValue(EMMA_NUMBER);
    await expect(field(page, "dateOfIssue")).toHaveValue("22 Oct 2022");
    await expect(field(page, "expiryDate")).toHaveValue("22 Oct 2032");
    // The trip check, worked out in the browser before saving.
    await expect(page.getByTestId("scanner-check")).toContainText(/^✓ Valid for your trip to .+ on \d{1,2} \w+ \d{4}\.$/);
    // The camera step, with its file inputs, is gone: no chosen file is held anywhere on screen.
    await expect(page.getByTestId("scanner-upload-input")).toHaveCount(0);

    // Correct one field: the last digit of the number, typed in lower case.
    await field(page, "passportNumber").fill("548193028");
    await field(page, "dateOfBirth").fill("03/03/1990");
    await page.getByTestId("scanner-save").click();
    await expect(scanner(page)).toHaveCount(0);

    const emma = page.getByTestId(`passenger-${emmaId}`);
    await expect(emma.getByTestId("passenger-status")).toHaveText("✓ Added");
    await expect(emma.getByTestId("passenger-passport")).toContainText("•••••3028");
    await expect(emma.getByTestId("passenger-passport")).toContainText("22 Oct 2032");
    await expect(emma.getByTestId("passenger-passport")).toContainText("3 Mar 1990");
    await expect(emma.getByTestId("passenger-check")).toContainText("Valid");
    await expect(page.getByTestId("checklist-passports")).toContainText("We have them for everyone");
    await expect(page.getByTestId("checklist-status-passports")).toHaveText("✓ Done");

    // Saved for real, ISO dates and the corrected number (staff see it; the customer never does).
    const [row] = await queryRows<{ passport_number: string; passport_expiry: string; date_of_birth: string; nationality: string; sex: string }>(
      `select passport_number, passport_expiry, date_of_birth, nationality, sex from client_passenger where id = $1`,
      [emmaId],
    );
    expect(row).toMatchObject({ passport_number: "548193028", passport_expiry: "2032-10-22", date_of_birth: "1990-03-03", sex: "F" });

    // No full number in anything the page received from the portal API, or on screen.
    for (const body of seen.bodies()) {
      expect(body).not.toContain("548193028");
      expect(body).not.toContain(EMMA_NUMBER);
      expect(body).not.toContain(LEAD_NUMBER);
    }
    const text = await page.evaluate(() => document.body.innerText);
    for (const n of ["548193028", EMMA_NUMBER, LEAD_NUMBER]) expect(text).not.toContain(n);
    const headers = await authHeaders(page);
    const list = await (await page.request.get("/api/v2/portal/passengers", { headers })).text();
    for (const n of ["548193028", LEAD_NUMBER]) expect(list).not.toContain(n);
  });

  test("an unreadable photo shows the server's message; 'Type the details in' opens the same form with what is known, never a number", async ({ page }) => {
    const { trip, emmaId } = await fixture(page);
    const message = "We couldn't read that photo. Try again with the photo page flat and no glare, or type the details in.";
    await stubPassportReadFailure(page, 422, "UNREADABLE", message);
    await page.goto(`/portal/booking/${trip.id}`);

    await page.getByTestId(`passenger-add-${emmaId}`).click();
    await photoInto(page);
    await expect(page.getByTestId("scanner-read-error")).toHaveText(message);

    await page.getByTestId("scanner-type-details").click();
    await expect(page.getByTestId("scanner-review")).toBeVisible();
    // Emma's name is already known to the agent, so it is filled in; the passport number never is.
    await expect(field(page, "surname")).toHaveValue("Bouy");
    await expect(field(page, "passportNumber")).toHaveValue("");

    await field(page, "surname").fill("Bouy");
    await field(page, "givenNames").fill("Emma");
    await field(page, "dateOfBirth").fill("3 March 1990");
    await field(page, "passportNumber").fill("ab123456");
    await field(page, "expiryDate").fill("22.10.2032");
    await page.getByTestId("scanner-save").click();
    await expect(scanner(page)).toHaveCount(0);
    const emma = page.getByTestId(`passenger-${emmaId}`);
    await expect(emma.getByTestId("passenger-passport")).toContainText("•••••3456");
    await expect(emma.getByTestId("passenger-passport")).toContainText("22 Oct 2032");
  });

  test("'Try another photo' goes back to the camera step", async ({ page }) => {
    const { trip, emmaId } = await fixture(page);
    await stubPassportReadFailure(page, 422, "UNREADABLE", "We couldn't read that photo.");
    await page.goto(`/portal/booking/${trip.id}`);
    await page.getByTestId(`passenger-add-${emmaId}`).click();
    await photoInto(page);
    await expect(page.getByTestId("scanner-read-error")).toBeVisible();
    await page.getByTestId("scanner-try-another").click();
    await expect(page.getByTestId("scanner-camera")).toBeVisible();
  });

  test("a rate-limited read shows the server's message and still offers to type the details in", async ({ page }) => {
    const { trip, emmaId } = await fixture(page);
    const message = "You've used all of today's passport reads. Please type the details in, or try again tomorrow.";
    await stubPassportReadFailure(page, 429, "RATE_LIMITED", message);
    await page.goto(`/portal/booking/${trip.id}`);
    await page.getByTestId(`passenger-add-${emmaId}`).click();
    await photoInto(page);
    await expect(page.getByTestId("scanner-read-error")).toHaveText(message);
    await expect(page.getByTestId("scanner-type-details")).toBeVisible();
  });

  test("a date that cannot be read gets a field error and nothing is sent", async ({ page }) => {
    const { trip, emmaId } = await fixture(page);
    let saves = 0;
    await page.route(/\/api\/v2\/portal\/passengers\/[^/]+\/passport$/, async (route) => {
      saves += 1;
      await route.continue();
    });
    await page.goto(`/portal/booking/${trip.id}`);
    await page.getByTestId(`passenger-add-${emmaId}`).click();
    await page.getByTestId("scanner-type-instead").click();
    await field(page, "surname").fill("Bouy");
    await field(page, "givenNames").fill("Emma");
    await field(page, "dateOfBirth").fill("3 Mar 1990");
    await field(page, "passportNumber").fill("AB123456");
    await field(page, "expiryDate").fill("22/10/32");
    await expect(page.getByTestId("scanner-check")).toHaveText("Write the dates like 22 Oct 2032 so we can check them.");
    await page.getByTestId("scanner-save").click();
    await expect(page.getByTestId("scanner-error-expiryDate")).toHaveText("Write the date like 22 Oct 2032.");
    await expect(field(page, "expiryDate")).toHaveAttribute("aria-invalid", "true");
    expect(saves).toBe(0);
    // Fixing it clears the error and saves; the typed date is shown back the way the design writes it.
    await field(page, "expiryDate").fill("22/10/2032");
    await field(page, "expiryDate").blur();
    await expect(field(page, "expiryDate")).toHaveValue("22 Oct 2032");
    await page.getByTestId("scanner-save").click();
    await expect(scanner(page)).toHaveCount(0);
  });

  test("a server message on save is shown in the scanner and the form is kept", async ({ page }) => {
    const { trip, emmaId } = await fixture(page);
    await page.route(/\/api\/v2\/portal\/passengers\/[^/]+\/passport$/, (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Passports can't be saved right now. Please try again shortly.", code: "PASSPORTS_UNAVAILABLE" }) }),
    );
    await page.goto(`/portal/booking/${trip.id}`);
    await page.getByTestId(`passenger-add-${emmaId}`).click();
    await page.getByTestId("scanner-type-instead").click();
    await field(page, "surname").fill("Bouy");
    await field(page, "givenNames").fill("Emma");
    await field(page, "dateOfBirth").fill("3 Mar 1990");
    await field(page, "passportNumber").fill("AB123456");
    await field(page, "expiryDate").fill("22 Oct 2032");
    await page.getByTestId("scanner-save").click();
    await expect(page.getByTestId("scanner-save-error")).toHaveText("Passports can't be saved right now. Please try again shortly.");
    await expect(field(page, "surname")).toHaveValue("Bouy");
  });

  test("'Add another traveller' adds a Traveller 3 row; 'Update passport' re-opens a saved one", async ({ page }) => {
    const { trip } = await fixture(page);
    await page.goto(`/portal/booking/${trip.id}`);
    await page.getByTestId("passenger-add-another").click();
    await page.getByTestId("scanner-type-instead").click();
    await field(page, "surname").fill("Bouy");
    await field(page, "givenNames").fill("Lily");
    await field(page, "dateOfBirth").fill("1 Jan 2015");
    await field(page, "passportNumber").fill("LL1234567");
    await field(page, "expiryDate").fill("1 Jan 2030");
    await page.getByTestId("scanner-save").click();
    await expect(scanner(page)).toHaveCount(0);
    const rows = page.locator('[data-testid="passenger-name"]');
    await expect(rows).toHaveCount(3);
    await expect(page.getByTestId("booking-passports")).toContainText("Traveller 3");
    await expect(page.getByTestId("booking-passports")).toContainText("Lily Bouy");

    // Update the lead's passport: the form opens pre-filled from what is known (never the number).
    await page.locator('[data-testid^="passenger-update-"]').first().click();
    await page.getByTestId("scanner-type-instead").click();
    await expect(field(page, "expiryDate")).toHaveValue("9 Feb 2035");
    await expect(field(page, "passportNumber")).toHaveValue("");
  });

  test("Escape closes the scanner and puts focus back on the button that opened it", async ({ page }) => {
    const { trip, emmaId } = await fixture(page);
    await page.goto(`/portal/booking/${trip.id}`);
    const opener = page.getByTestId(`passenger-add-${emmaId}`);
    await opener.click();
    await expect(scanner(page)).toBeVisible();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="passport-scanner"]'))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(scanner(page)).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test("the '#passports' address opens the bookings screen scrolled to the Passports section", async ({ page }) => {
    await fixture(page);
    await page.goto("/portal/bookings#passports");
    await expect(page.getByTestId("booking-passports")).toBeVisible();
    await expect(page.getByTestId("booking-passports")).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  });

  test("another customer's travellers are never shown or returned", async ({ page }) => {
    const { trip } = await fixture(page);
    const other = await seedPortalCustomer();
    await seedPortalPassenger(other.clientId, { firstName: "Stranger", surname: "Elsewhere", passportNumber: "ZZ9999999", passportExpiry: "2034-01-01" });
    await page.goto(`/portal/booking/${trip.id}`);
    await expect(page.getByTestId("booking-passports")).toBeVisible();
    expect(await page.evaluate(() => document.body.innerText)).not.toContain("Stranger");
    const raw = await (await page.request.get("/api/v2/portal/passengers", { headers: await authHeaders(page) })).text();
    expect(raw).not.toContain("Stranger");
    expect(raw).not.toContain("ZZ9999999");
  });

  test("at 360px the scanner and the passport blocks do not scroll sideways, and the text buttons are at least 44px tall", async ({ page }) => {
    const { trip, emmaId } = await fixture(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`/portal/booking/${trip.id}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await page.getByTestId(`passenger-add-${emmaId}`).click();
    const upload = await page.getByText("Upload a photo instead").boundingBox();
    expect(upload?.height ?? 0).toBeGreaterThanOrEqual(43.5);
    const typeIn = await page.getByTestId("scanner-type-instead").boundingBox();
    expect(typeIn?.height ?? 0).toBeGreaterThanOrEqual(43.5);
    expect(await scanner(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
});

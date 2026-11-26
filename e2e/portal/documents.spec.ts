/**
 * Customer portal: "My documents / Your paperwork." on the booking screen. A customer sees (and can download) a file
 * ONLY when staff linked it to one of that customer's own deals: a real booking, quote or enquiry id of theirs. Unlinked
 * files, placeholder ids and files pointing at someone else's record are invisible and their download is a 404.
 * Files are written to the practice database (helpers/portal-paperwork.ts). The happy-path download is NOT stubbed: it
 * hits the real server with a real local file. The practice environment has no real object storage, so the signed-link
 * (S3) contract is asserted only if the server can sign there (see the "signed link" test).
 */
import type { Page } from "@playwright/test";
import { expect, test } from "../helpers/fixtures";
import { seedPortalCustomer, startSignedIn } from "../helpers/portal";
import { seedPortalBooking, type SeededPortalBooking } from "../helpers/portal-bookings";
import { seedPortalFile } from "../helpers/portal-paperwork";
import { seedPortalQuoteWorld, type PortalQuoteWorld } from "../helpers/portal-quotes";

interface Fixture {
  q: PortalQuoteWorld;
  trip: SeededPortalBooking;
}

async function fixture(page: Page): Promise<Fixture> {
  const q = await seedPortalQuoteWorld(page);
  const trip = await seedPortalBooking(page, q, { title: "Hotel Playa Azul Majorca", travelDate: 45 });
  await startSignedIn(page, q.portal);
  return { q, trip };
}

const authHeaders = async (page: Page) => ({ Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("portal_token"))}` });

interface ListedDocument {
  id: string;
  name: string;
  dealId?: string;
}

async function listFor(page: Page, bookingId?: string): Promise<ListedDocument[]> {
  const headers = await authHeaders(page);
  const url = bookingId ? `/api/v2/portal/documents?bookingId=${bookingId}` : "/api/v2/portal/documents";
  const res = await page.request.get(url, { headers });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as ListedDocument[];
}

test.describe("customer portal: my documents", () => {
  test("lists only the files linked to this booking, each with its detail line; unlinked and other-booking files are absent", async ({ page }) => {
    const { q, trip } = await fixture(page);
    const later = await seedPortalBooking(page, q, { title: "Later Lanzarote Break", travelDate: 120 });
    await seedPortalFile(q.portal.clientId, { name: "confirmation.pdf", title: "Booking confirmation", category: "Tickets", size: 240_000, bookingId: trip.id });
    await seedPortalFile(q.portal.clientId, { name: "insurance.pdf", category: "Insurance", size: 1_400_000 });
    await seedPortalFile(q.portal.clientId, { name: "other-holiday.pdf", title: "Lanzarote voucher", bookingId: later.id });

    await page.goto(`/portal/booking/${trip.id}`);
    const section = page.getByTestId("booking-documents");
    await expect(section).toContainText("My documents");
    await expect(section).toContainText(/Your\s*paperwork\./);
    await expect(section.getByTestId("document-name")).toHaveCount(1);
    await expect(section).toContainText("Booking confirmation");
    await expect(section).toContainText("PDF · Tickets · 240 KB");
    await expect(section.getByRole("button", { name: "Download Booking confirmation" })).toBeVisible();
    // Linked to nothing: not shown. Linked to another of the customer's bookings: not on this booking's screen.
    await expect(section).not.toContainText("insurance.pdf");
    await expect(section).not.toContainText("Lanzarote voucher");
    // It is a plain list of files: no invented "Soon" rows (the closing note is the only place the word appears).
    await expect(section.getByTestId("documents-list")).not.toContainText(/soon/i);
    // Nothing customer-facing talks about linking files.
    expect(await section.innerText()).not.toMatch(/\blink(ed|ing)?\b|allocat/i);
  });

  test("Download hits the real server with the signed-in token, saves the file and shows Saved", async ({ page }) => {
    const { q, trip } = await fixture(page);
    const fileId = await seedPortalFile(q.portal.clientId, { name: "confirmation.pdf", title: "Booking confirmation", category: "Tickets", bookingId: trip.id, storage: "local" });
    let status = 0;
    page.on("response", (res) => {
      if (res.url().includes(`/api/v2/portal/documents/${fileId}/download`)) status = res.status();
    });

    await page.goto(`/portal/booking/${trip.id}`);
    const button = page.getByTestId(`document-download-${fileId}`);
    const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
    expect(download.suggestedFilename()).toBe("confirmation.pdf");
    await expect(button).toHaveText("Saved ✓");
    expect(status).toBe(200);

    // The same call without a session is refused.
    expect((await page.request.get(`/api/v2/portal/documents/${fileId}/download`)).status()).toBe(401);
  });

  test("a file stored as an object-store key answers with the signed-link JSON { url, fileName, expiresInSeconds }", async ({ page }) => {
    const { q, trip } = await fixture(page);
    const fileId = await seedPortalFile(q.portal.clientId, { name: "voucher.pdf", title: "Hotel voucher", bookingId: trip.id, storage: "s3" });
    await page.goto("/portal");
    const res = await page.request.get(`/api/v2/portal/documents/${fileId}/download`, { headers: await authHeaders(page) });
    // The practice environment has no real object storage; signing needs its settings. Without them the contract
    // cannot be produced here (it is covered by portal-documents.service/controller unit tests).
    test.skip(res.status() !== 200, `the practice server cannot sign object-store links (answered ${res.status()})`);
    const body = (await res.json()) as { url: string; fileName: string; expiresInSeconds: number };
    expect(Object.keys(body).sort()).toEqual(["expiresInSeconds", "fileName", "url"]);
    expect(body.fileName).toBe("voucher.pdf");
    expect(body.url).toMatch(/^https?:\/\//);
    expect(body.expiresInSeconds).toBeGreaterThan(0);
  });

  test("a download that fails says so in plain words, and the row stays usable", async ({ page }) => {
    const { q, trip } = await fixture(page);
    // Linked and listed, but nothing is stored on disk for it: the server's own 404.
    const fileId = await seedPortalFile(q.portal.clientId, { name: "gone.pdf", title: "Old voucher", bookingId: trip.id });

    await page.goto(`/portal/booking/${trip.id}`);
    await page.getByTestId(`document-download-${fileId}`).click();
    await expect(page.getByTestId("document-error")).toHaveText("That document is no longer available.");
    await expect(page.getByTestId(`document-download-${fileId}`)).toBeEnabled();
  });

  test("an unlinked file is absent from the list and its download is a 404", async ({ page }) => {
    const { q, trip } = await fixture(page);
    const unlinked = await seedPortalFile(q.portal.clientId, { name: "loose.pdf", title: "LOOSE-FILE", storage: "local" });
    await page.goto(`/portal/booking/${trip.id}`);
    await expect(page.getByTestId("booking-documents")).toBeVisible();
    await expect(page.getByTestId("documents-list")).toHaveCount(0);
    expect(await page.evaluate(() => document.body.innerText)).not.toContain("LOOSE-FILE");
    const headers = await authHeaders(page);
    expect((await listFor(page)).map((d) => d.id)).not.toContain(unlinked);
    expect((await listFor(page, trip.id)).map((d) => d.id)).not.toContain(unlinked);
    expect((await page.request.get(`/api/v2/portal/documents/${unlinked}/download`, { headers })).status()).toBe(404);
  });

  test("a file whose link is the old placeholder id 'booking-1' is absent", async ({ page }) => {
    const { q, trip } = await fixture(page);
    const placeholder = await seedPortalFile(q.portal.clientId, { name: "old.pdf", title: "PLACEHOLDER-FILE", link: { type: "Booking", id: "booking-1" }, storage: "local" });
    await page.goto(`/portal/booking/${trip.id}`);
    await expect(page.getByTestId("booking-documents")).toBeVisible();
    expect(await page.evaluate(() => document.body.innerText)).not.toContain("PLACEHOLDER-FILE");
    const headers = await authHeaders(page);
    expect((await listFor(page)).map((d) => d.id)).not.toContain(placeholder);
    expect((await page.request.get(`/api/v2/portal/documents/${placeholder}/download`, { headers })).status()).toBe(404);
  });

  test("another customer's files are never shown, listed or downloadable, and a file pointing at someone else's booking is absent for both", async ({ page }) => {
    const { q, trip } = await fixture(page);
    await seedPortalFile(q.portal.clientId, { name: "mine.pdf", title: "My own file", bookingId: trip.id, storage: "local" });
    // Another customer (same agency world is not needed): their own file, linked to THEIR OWN booking.
    const other = await seedPortalQuoteWorld(page);
    const theirTrip = await seedPortalBooking(page, other, { title: "Their Trip", travelDate: 50 });
    const theirs = await seedPortalFile(other.portal.clientId, { name: "theirs.pdf", title: "SOMEONE-ELSES-FILE", bookingId: theirTrip.id, storage: "local" });
    // Crossed wires: a file on OUR profile whose link points at THEIR booking, and one on THEIR profile pointing at ours.
    const crossedA = await seedPortalFile(q.portal.clientId, { name: "crossed-a.pdf", title: "CROSSED-A", bookingId: theirTrip.id, storage: "local" });
    const crossedB = await seedPortalFile(other.portal.clientId, { name: "crossed-b.pdf", title: "CROSSED-B", bookingId: trip.id, storage: "local" });
    // Signing in again as the first customer (the second world signed the page in as its own staff agent).
    await startSignedIn(page, q.portal);

    await page.goto(`/portal/booking/${trip.id}`);
    await expect(page.getByTestId("booking-documents")).toContainText("My own file");
    const text = await page.evaluate(() => document.body.innerText);
    for (const secret of ["SOMEONE-ELSES-FILE", "CROSSED-A", "CROSSED-B"]) expect(text).not.toContain(secret);

    const headers = await authHeaders(page);
    const list = await listFor(page);
    expect(list.map((d) => d.id)).not.toContain(theirs);
    expect(list.map((d) => d.id)).not.toContain(crossedA);
    expect(list.map((d) => d.id)).not.toContain(crossedB);
    expect(JSON.stringify(list)).not.toMatch(/SOMEONE-ELSES-FILE|CROSSED-/);
    for (const id of [theirs, crossedA, crossedB]) {
      expect((await page.request.get(`/api/v2/portal/documents/${id}/download`, { headers })).status(), id).toBe(404);
    }
    expect((await page.request.get(`/api/v2/portal/documents/${theirs}/download`)).status()).toBe(401);
  });

  test("a quote-linked file on a booked deal shows under that booking, and each item carries its dealId", async ({ page }) => {
    const { q, trip } = await fixture(page);
    const viaQuote = await seedPortalFile(q.portal.clientId, { name: "quote-file.pdf", title: "From the quote", category: "Tickets", link: { type: "Quote", id: trip.quoteId }, storage: "local" });
    const viaBooking = await seedPortalFile(q.portal.clientId, { name: "booking-file.pdf", title: "From the booking", bookingId: trip.id, storage: "local" });

    await page.goto(`/portal/booking/${trip.id}`);
    const section = page.getByTestId("booking-documents");
    await expect(section).toContainText("From the quote");
    await expect(section).toContainText("From the booking");

    const items = await listFor(page, trip.id);
    expect(items.map((d) => d.id).sort()).toEqual([viaQuote, viaBooking].sort());
    for (const item of items) expect(typeof item.dealId, `dealId on ${item.name}`).toBe("string");
    expect(new Set(items.map((d) => d.dealId)).size, "both files are on the same deal").toBe(1);
  });

  test("with no linked files there are no rows, and the note says we'll tell them when documents are ready", async ({ page }) => {
    const { q, trip } = await fixture(page);
    // A booking with only unlinked files shows the empty state.
    await seedPortalFile(q.portal.clientId, { name: "loose.pdf", title: "Loose file" });
    await page.goto(`/portal/booking/${trip.id}`);
    const section = page.getByTestId("booking-documents");
    await expect(section).toContainText(/Your\s*paperwork\./);
    await expect(page.getByTestId("documents-list")).toHaveCount(0);
    await expect(page.getByTestId("documents-note")).toHaveText("We'll let you know as soon as your tickets and documents are ready.");
    // The checklist agrees: nothing to download yet.
    await expect(page.getByTestId("checklist-documents")).toContainText("We'll let you know when they are ready");
    await expect(page.getByTestId("checklist-status-documents")).toHaveText("To do");
  });

  test("the checklist's Travel documents row follows a linked file", async ({ page }) => {
    const { q, trip } = await fixture(page);
    await seedPortalFile(q.portal.clientId, { name: "confirmation.pdf", title: "Booking confirmation", bookingId: trip.id });
    await page.goto(`/portal/booking/${trip.id}`);
    await expect(page.getByTestId("documents-list")).toBeVisible();
    await expect(page.getByTestId("checklist-status-documents")).not.toHaveText("To do");
  });

  test("a failed load says so and Try again recovers", async ({ page }) => {
    const { q, trip } = await fixture(page);
    await seedPortalFile(q.portal.clientId, { name: "confirmation.pdf", title: "Booking confirmation", bookingId: trip.id });
    let fail = true;
    await page.route(/\/api\/v2\/portal\/documents\?/, async (route) => {
      if (fail) await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Failed" }) });
      else await route.continue();
    });
    await page.goto(`/portal/booking/${trip.id}`);
    await expect(page.getByTestId("documents-error")).toBeVisible();
    fail = false;
    await page.getByTestId("documents-retry").click();
    await expect(page.getByTestId("booking-documents")).toContainText("Booking confirmation");
  });

  test("at 360px the long file name wraps: no sideways scrolling", async ({ page }) => {
    const { q, trip } = await fixture(page);
    await seedPortalFile(q.portal.clientId, { name: `${"VeryLongFileName".repeat(8)}.pdf`, category: "Tickets", bookingId: trip.id });
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`/portal/booking/${trip.id}`);
    await expect(page.getByTestId("booking-documents")).toBeVisible();
    await expect(page.getByTestId("document-name")).toBeVisible();
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });
});

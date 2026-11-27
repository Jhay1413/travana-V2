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
import { seedPortalFile, seedPortalPassenger } from "../helpers/portal-paperwork";
import { queryRows } from "../helpers/seed";
import { BASE_URL } from "../helpers/env";
import { expectFitsViewport } from "../helpers/ui";
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
    // Explicit long unbroken names, not random suffix widths: the customer (the lead) and two travellers, one with a
    // saved passport and one without, so the Passports band's name/status rows are in the measured page too.
    const long = "Abcdefghijklmnopqrstuvwxyz0123";
    await queryRows(`update client_table set "firstName" = $2, surename = $3 where id = $1`, [q.portal.clientId, long, long]);
    await seedPortalPassenger(q.portal.clientId, { isLead: true, passportNumber: "531764821", passportExpiry: "2035-02-09" });
    await seedPortalPassenger(q.portal.clientId, { firstName: long, surname: long, dateOfBirth: "1990-03-03", passportNumber: "548193027", passportExpiry: "2035-02-09" });
    await seedPortalPassenger(q.portal.clientId, { firstName: long, surname: long, dateOfBirth: "1991-03-03" });
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`/portal/booking/${trip.id}`);
    await expect(page.getByTestId("booking-documents")).toBeVisible();
    await expect(page.getByTestId("document-name")).toBeVisible();
    await expect(page.getByTestId("passenger-name")).toHaveCount(3);
    await expect(page.getByTestId("passenger-status")).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });
});

/**
 * "View" opens a document inside the app (a full-screen viewer) instead of only saving it. The bytes are real: a
 * hand-built one-page PDF and a real PNG written to uploads/client-files by the helper (and removed afterwards), served
 * by the real /view endpoint, drawn by the real PDF.js worker bundled with the app. Nothing is stubbed except where a
 * test says so (a forced fetch failure).
 */
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface ListedViewable extends ListedDocument {
  viewable: boolean;
  viewKind: string | null;
}

test.describe("customer portal: viewing a document in the app", () => {
  test("View is offered for a PDF and an image, not for a Word file; Download stays on every row", async ({ page }) => {
    const { q, trip } = await fixture(page);
    const pdf = await seedPortalFile(q.portal.clientId, { name: "confirmation.pdf", title: "Booking confirmation", bookingId: trip.id, storage: "local" });
    const png = await seedPortalFile(q.portal.clientId, { name: "boarding.png", title: "Boarding photo", mimeType: "image/png", bookingId: trip.id, storage: "local" });
    const docx = await seedPortalFile(q.portal.clientId, { name: "terms.docx", title: "Terms", mimeType: DOCX, bookingId: trip.id, storage: "local" });
    // Stored type and extension disagree: not offered, even though one of them looks viewable.
    const odd = await seedPortalFile(q.portal.clientId, { name: "scan.docx", title: "Odd scan", mimeType: "application/pdf", bookingId: trip.id, storage: "local" });

    await page.goto(`/portal/booking/${trip.id}`);
    await expect(page.getByTestId("documents-list")).toBeVisible();
    await expect(page.getByTestId(`document-view-${pdf}`)).toBeVisible();
    await expect(page.getByTestId(`document-view-${png}`)).toBeVisible();
    await expect(page.getByTestId(`document-view-${docx}`)).toHaveCount(0);
    await expect(page.getByTestId(`document-view-${odd}`)).toHaveCount(0);
    for (const id of [pdf, png, docx, odd]) await expect(page.getByTestId(`document-download-${id}`)).toBeVisible();

    // The server's own answer is what decides.
    const byId = Object.fromEntries(((await listFor(page, trip.id)) as ListedViewable[]).map((d) => [d.id, d]));
    expect([byId[pdf].viewable, byId[pdf].viewKind]).toEqual([true, "pdf"]);
    expect([byId[png].viewable, byId[png].viewKind]).toEqual([true, "image"]);
    expect([byId[docx].viewable, byId[docx].viewKind]).toEqual([false, null]);
    expect([byId[odd].viewable, byId[odd].viewKind]).toEqual([false, null]);
  });

  test("opening a PDF draws its page on a canvas with 'Page 1 of 1', from this site only; Download works inside the viewer", async ({ page }) => {
    const { q, trip } = await fixture(page);
    const fileId = await seedPortalFile(q.portal.clientId, { name: "confirmation.pdf", title: "Booking confirmation", bookingId: trip.id, storage: "local" });
    const origin = new URL(BASE_URL).origin;
    const outside: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (!url.startsWith(origin) && !url.startsWith("data:") && !url.startsWith("blob:")) outside.push(url);
    });

    await page.goto(`/portal/booking/${trip.id}`);
    await expect(page.getByTestId("documents-list")).toBeVisible();
    // Only what opening the viewer causes counts (the page's own web fonts load earlier, and are not part of this feature).
    outside.length = 0;
    await page.getByTestId(`document-view-${fileId}`).click();
    await expect(page.getByTestId("document-viewer")).toBeVisible();
    await expect(page.getByTestId("viewer-doc-title")).toHaveText("Booking confirmation");
    await expect(page.getByTestId("pdf-page-count")).toHaveText("Page 1 of 1");

    const canvas = page.getByTestId("pdf-canvas").first();
    await expect.poll(async () => canvas.evaluate((c) => (c as HTMLCanvasElement).width)).toBeGreaterThan(0);
    const box = await canvas.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(0);
    expect(box?.height ?? 0).toBeGreaterThan(0);
    // Something was actually painted: not every pixel is the blank white page.
    await expect
      .poll(async () =>
        canvas.evaluate((c) => {
          const el = c as HTMLCanvasElement;
          const data = el.getContext("2d")?.getImageData(0, 0, el.width, el.height).data;
          if (!data) return false;
          for (let i = 0; i < data.length; i += 4) if (data[i] < 200 || data[i + 1] < 200 || data[i + 2] < 200) return true;
          return false;
        }),
      )
      .toBe(true);

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("viewer-doc-download").click()]);
    expect(download.suggestedFilename()).toBe("confirmation.pdf");
    await expect(page.getByTestId("viewer-doc-download")).toHaveText("Saved ✓");
    expect(outside, "opening the viewer made no request outside this site").toEqual([]);
  });

  test("opening an image shows it, named for screen readers, and the viewer covers the whole screen", async ({ page }) => {
    const { q, trip } = await fixture(page);
    const fileId = await seedPortalFile(q.portal.clientId, { name: "boarding.png", title: "Boarding photo", mimeType: "image/png", bookingId: trip.id, storage: "local" });
    await page.goto(`/portal/booking/${trip.id}`);
    await page.getByTestId(`document-view-${fileId}`).click();
    const image = page.getByTestId("viewer-doc-image");
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute("alt", "Boarding photo");
    await expect(image).toHaveAttribute("src", /^blob:/);
    await expect.poll(async () => image.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const viewport = page.viewportSize();
    const box = await page.getByTestId("document-viewer").boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(viewport?.width);
    expect(Math.round(box?.height ?? 0)).toBe(viewport?.height);
  });

  test("Close and Escape both return focus to the row's View button; the image's object URL is released", async ({ page }) => {
    const { q, trip } = await fixture(page);
    const fileId = await seedPortalFile(q.portal.clientId, { name: "boarding.png", title: "Boarding photo", mimeType: "image/png", bookingId: trip.id, storage: "local" });
    await page.addInitScript(() => {
      const w = window as unknown as { __revoked: string[] };
      w.__revoked = [];
      const revoke = URL.revokeObjectURL.bind(URL);
      URL.revokeObjectURL = (url: string) => {
        w.__revoked.push(url);
        revoke(url);
      };
    });
    await page.goto(`/portal/booking/${trip.id}`);
    const view = page.getByTestId(`document-view-${fileId}`);

    await view.click();
    await expect(page.getByTestId("viewer-doc-image")).toBeVisible();
    const src = await page.getByTestId("viewer-doc-image").getAttribute("src");
    await page.getByTestId("viewer-doc-close").click();
    await expect(page.getByTestId("document-viewer")).toHaveCount(0);
    await expect(view).toBeFocused();
    expect(await page.evaluate(() => (window as unknown as { __revoked: string[] }).__revoked)).toContain(src);

    await view.click();
    await expect(page.getByTestId("viewer-doc-image")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("document-viewer")).toHaveCount(0);
    await expect(view).toBeFocused();
  });

  test("focus stays inside the open viewer when tabbing", async ({ page }) => {
    const { q, trip } = await fixture(page);
    const fileId = await seedPortalFile(q.portal.clientId, { name: "confirmation.pdf", title: "Booking confirmation", bookingId: trip.id, storage: "local" });
    await page.goto(`/portal/booking/${trip.id}`);
    await page.getByTestId(`document-view-${fileId}`).click();
    await expect(page.getByTestId("pdf-page-count")).toHaveText("Page 1 of 1");
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="document-viewer"]'))).toBe(true);
    }
  });

  test("/view answers 404 for another customer's file, an unlinked file, a placeholder link, an unknown id and a malformed id; 401 without a session", async ({ page }) => {
    const { q, trip } = await fixture(page);
    const unlinked = await seedPortalFile(q.portal.clientId, { name: "loose.pdf", title: "Loose", storage: "local" });
    const placeholder = await seedPortalFile(q.portal.clientId, { name: "old.pdf", link: { type: "Booking", id: "booking-1" }, storage: "local" });
    const other = await seedPortalQuoteWorld(page);
    const theirTrip = await seedPortalBooking(page, other, { title: "Their Trip", travelDate: 50 });
    const theirs = await seedPortalFile(other.portal.clientId, { name: "theirs.pdf", bookingId: theirTrip.id, storage: "local" });
    const crossed = await seedPortalFile(q.portal.clientId, { name: "crossed.pdf", bookingId: theirTrip.id, storage: "local" });
    await startSignedIn(page, q.portal);
    await page.goto("/portal");
    const headers = await authHeaders(page);

    const bodies = new Set<string>();
    for (const id of [unlinked, placeholder, theirs, crossed, "00000000-0000-4000-8000-000000000000", "not-an-id"]) {
      const res = await page.request.get(`/api/v2/portal/documents/${id}/view`, { headers });
      expect(res.status(), id).toBe(404);
      bodies.add(await res.text());
    }
    expect(bodies.size, "every miss reads exactly the same").toBe(1);
    expect((await page.request.get(`/api/v2/portal/documents/${theirs}/view`)).status()).toBe(401);
  });

  test("/view sends the exact locked-down headers and the real bytes for a PDF and an image", async ({ page }) => {
    const { q, trip } = await fixture(page);
    const pdf = await seedPortalFile(q.portal.clientId, { name: "Ticket pack.pdf", title: "Tickets", bookingId: trip.id, storage: "local" });
    const png = await seedPortalFile(q.portal.clientId, { name: "boarding.png", mimeType: "image/png", bookingId: trip.id, storage: "local" });
    await page.goto("/portal");
    const headers = await authHeaders(page);

    const pdfRes = await page.request.get(`/api/v2/portal/documents/${pdf}/view`, { headers });
    expect(pdfRes.status()).toBe(200);
    const h = pdfRes.headers();
    expect(h["content-type"]).toBe("application/pdf");
    expect(h["content-disposition"]).toBe(`inline; filename="Ticket pack.pdf"; filename*=UTF-8''Ticket%20pack.pdf`);
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["cache-control"]).toBe("private, no-store");
    expect(h["content-security-policy"]).toBe("sandbox; default-src 'none'");
    expect(h["cross-origin-resource-policy"]).toBe("same-origin");
    const pdfBytes = await pdfRes.body();
    expect(pdfBytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(Number(h["content-length"])).toBe(pdfBytes.length);

    const pngRes = await page.request.get(`/api/v2/portal/documents/${png}/view`, { headers });
    expect(pngRes.status()).toBe(200);
    expect(pngRes.headers()["content-type"]).toBe("image/png");
    expect(pngRes.headers()["content-disposition"]).toMatch(/^inline; filename="boarding\.png"/);
    expect((await pngRes.body()).subarray(1, 4).toString("latin1")).toBe("PNG");
  });

  test("/view refuses a Word file (415) and a file over the preview limit (413), each with a plain message", async ({ page }) => {
    const { q, trip } = await fixture(page);
    const docx = await seedPortalFile(q.portal.clientId, { name: "terms.docx", mimeType: DOCX, bookingId: trip.id, storage: "local" });
    const huge = await seedPortalFile(q.portal.clientId, { name: "huge.pdf", size: 26 * 1024 * 1024, bookingId: trip.id, storage: "local" });
    await page.goto("/portal");
    const headers = await authHeaders(page);
    const word = await page.request.get(`/api/v2/portal/documents/${docx}/view`, { headers });
    expect(word.status()).toBe(415);
    expect(await word.json()).toEqual({ error: "This document can't be previewed. Please download it." });
    const big = await page.request.get(`/api/v2/portal/documents/${huge}/view`, { headers });
    expect(big.status()).toBe(413);
    expect(await big.json()).toEqual({ error: "This file is too large to preview. Please download it." });
  });

  test("a file named .pdf whose bytes are not a PDF answers 415; the viewer says so with Download, and View goes away", async ({ page }) => {
    const { q, trip } = await fixture(page);
    const fileId = await seedPortalFile(q.portal.clientId, {
      name: "fake.pdf",
      title: "Fake paperwork",
      bookingId: trip.id,
      storage: "local",
      content: Buffer.from("<html><script>alert(1)</script></html>"),
    });
    await page.goto("/portal");
    const res = await page.request.get(`/api/v2/portal/documents/${fileId}/view`, { headers: await authHeaders(page) });
    expect(res.status()).toBe(415);

    await page.goto(`/portal/booking/${trip.id}`);
    await page.getByTestId(`document-view-${fileId}`).click();
    await expect(page.getByTestId("viewer-doc-error")).toContainText("This document can't be previewed. Please download it.");
    await expect(page.getByTestId("viewer-doc-retry")).toHaveCount(0);
    await expect(page.getByTestId("viewer-doc-error-download")).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("viewer-doc-error-download").click()]);
    expect(download.suggestedFilename()).toBe("fake.pdf");

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("document-viewer")).toHaveCount(0);
    await expect(page.getByTestId(`document-view-${fileId}`)).toHaveCount(0);
    await expect(page.getByTestId(`document-download-${fileId}`)).toBeFocused();
  });

  test("a PDF that PDF.js cannot read says so plainly and offers Download", async ({ page }) => {
    const { q, trip } = await fixture(page);
    // Right signature, nothing behind it: the server relays it, PDF.js refuses it.
    const fileId = await seedPortalFile(q.portal.clientId, {
      name: "broken.pdf",
      title: "Broken PDF",
      bookingId: trip.id,
      storage: "local",
      content: Buffer.from("%PDF-1.4\nthis is not a real pdf\n"),
    });
    await page.goto(`/portal/booking/${trip.id}`);
    await page.getByTestId(`document-view-${fileId}`).click();
    await expect(page.getByTestId("viewer-doc-error")).toBeVisible();
    await expect(page.getByTestId("viewer-doc-error")).toContainText(/damaged|couldn't open/i);
    await expect(page.getByTestId("viewer-doc-error-download")).toBeVisible();
  });

  test("a failed fetch says so with Retry and Download, and Retry recovers", async ({ page }) => {
    const { q, trip } = await fixture(page);
    const fileId = await seedPortalFile(q.portal.clientId, { name: "boarding.png", title: "Boarding photo", mimeType: "image/png", bookingId: trip.id, storage: "local" });
    let fail = true;
    await page.route(/\/api\/v2\/portal\/documents\/[^/]+\/view$/, async (route) => {
      if (fail) await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Failed" }) });
      else await route.continue();
    });
    await page.goto(`/portal/booking/${trip.id}`);
    await page.getByTestId(`document-view-${fileId}`).click();
    await expect(page.getByTestId("viewer-doc-error")).toContainText("We couldn't open that document. Please try again, or download it.");
    await expect(page.getByTestId("viewer-doc-error-download")).toBeVisible();
    fail = false;
    await page.getByTestId("viewer-doc-retry").click();
    await expect(page.getByTestId("viewer-doc-image")).toBeVisible();
  });

  test("a file with nothing stored says it is no longer available", async ({ page }) => {
    const { q, trip } = await fixture(page);
    // Listed and viewable by type, but nothing is stored for it: the same 404 the download gives.
    const fileId = await seedPortalFile(q.portal.clientId, { name: "gone.pdf", title: "Old voucher", bookingId: trip.id });
    await page.goto(`/portal/booking/${trip.id}`);
    await page.getByTestId(`document-view-${fileId}`).click();
    await expect(page.getByTestId("viewer-doc-error")).toContainText("That document is no longer available.");
    await expect(page.getByTestId("viewer-doc-retry")).toHaveCount(0);
  });

  for (const width of [320, 360]) {
    test(`at ${width}px a row with View and Download does not overflow, and the viewer's top bar fits`, async ({ page }) => {
      const { q, trip } = await fixture(page);
      const name = `${"VeryLongFileName".repeat(4)}.pdf`;
      const fileId = await seedPortalFile(q.portal.clientId, { name, category: "Tickets", bookingId: trip.id, storage: "local" });
      await page.setViewportSize({ width, height: 740 });
      await page.goto(`/portal/booking/${trip.id}`);
      await expect(page.getByTestId(`document-view-${fileId}`)).toBeVisible();
      await expect(page.getByTestId(`document-download-${fileId}`)).toBeVisible();
      await expectFitsViewport(page, width, "documents row with View and Download");
      for (const id of [`document-view-${fileId}`, `document-download-${fileId}`]) {
        const box = await page.getByTestId(id).boundingBox();
        expect((box?.x ?? 0) + (box?.width ?? 0), id).toBeLessThanOrEqual(width);
      }

      await page.getByTestId(`document-view-${fileId}`).click();
      await expect(page.getByTestId("pdf-page-count")).toHaveText("Page 1 of 1");
      for (const id of ["viewer-doc-download", "viewer-doc-close"]) {
        const box = await page.getByTestId(id).boundingBox();
        expect(box?.x ?? -1, id).toBeGreaterThanOrEqual(0);
        expect((box?.x ?? 0) + (box?.width ?? 0), id).toBeLessThanOrEqual(width);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
});

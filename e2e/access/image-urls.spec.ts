/**
 * S5: the image proxy (GET /api/v2/files/img?key=) only serves keys under the public image prefixes, and the image
 * strings submitted on a quote are validated, so a proxy url pointing at a private object (client files, HR
 * documents, attachments) can neither be served nor stored and later deleted through a quote.
 */
import { request as playwrightRequest } from "@playwright/test";
import { dataOf, quotePayload } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { boardWorld, quoteDeal } from "../helpers/pipeline";
import { queryRows } from "../helpers/seed";

async function storedUrls(quoteId: string): Promise<(string | null)[]> {
  const rows = await queryRows<{ url: string | null }>(`select url from quote_images where quote_id = $1 order by position, id`, [quoteId]);
  return rows.map((r) => r.url);
}

test.describe("image proxy allow-list", () => {
  test("a non-image key is refused (404) and a real image key passes the allow-list", async ({ baseURL }) => {
    const anon = await playwrightRequest.newContext({ baseURL: baseURL!, extraHTTPHeaders: { "X-Forwarded-For": "10.7.7.7" } });
    for (const key of ["client-files/123-456.pdf", "hr/payslip.pdf", "note-attachments/1.pdf", "ticket-attachments/1.pdf", "quote-images/../client-files/1.pdf", "../secret"]) {
      const res = await anon.get(`/api/v2/files/img?key=${encodeURIComponent(key)}`, { maxRedirects: 0 });
      expect(res.status(), key).toBe(404);
      expect(await res.text(), key).toContain("Image not found");
    }
    expect((await anon.get(`/api/v2/files/img`, { maxRedirects: 0 })).status()).toBe(400);
    for (const key of [
      "quote-images/1700000000000-abc.jpg",
      "booking-images/1-a.png",
      "hub-images/1-a.webp",
      "social-upscale/1-a.png",
      "image-upscale/source/1-a.jpg",
      "tour-operator-logos/1-a.png",
      "training-assets/1-a.jpg",
      "training-thumbnails/1-a.jpg",
      "training-videos/1-a.mp4",
    ]) {
      const res = await anon.get(`/api/v2/files/img?key=${encodeURIComponent(key)}`, { maxRedirects: 0 });
      // The test server runs credential-free, so a key that passes the allow-list reaches the signer and fails there
      // with exactly 500; a refused key is 404 with "Image not found" and never reaches it. The redirect itself is
      // covered by file.controller.test.ts.
      expect(res.status(), key).toBe(500);
      expect(await res.text(), key).not.toContain("Image not found");
    }
    await anon.dispose();
  });
});

test.describe("image strings on a quote", () => {
  test("a proxy url for a private key is refused on update (400) and dropped (not stored) on create; https urls and the app's own images are accepted", async ({ page }) => {
    const w = await boardWorld(page);
    const own = "/api/v2/files/img?key=quote-images%2F1-a.jpg";
    const priv = "/api/v2/files/img?key=client-files%2F1-2.pdf";

    const refusedOnUpdate = await (async () => {
      const deal = await quoteDeal(page.request, w, { title: "Image rules" });
      const bad = await page.request.patch(`/api/v2/quotes/${deal.entityId}`, { data: { images: [priv] } });
      const good = await page.request.patch(`/api/v2/quotes/${deal.entityId}`, { data: { images: ["https://images.e2e.test/a.jpg", own] } });
      return { bad: bad.status(), good: good.status(), deal };
    })();
    expect(refusedOnUpdate.bad).toBe(400);
    expect(refusedOnUpdate.good).toBe(200);

    const create = await page.request.post("/api/v2/transactions", {
      data: { client_id: w.clientId, user_id: w.userId, quote: { ...quotePayload(w.agency, { title: "Refused" }), images: [priv] } },
    });
    // Create is lenient: the private key is dropped and reported, the deal is still created.
    const created = await dataOf<{ quote: { id: string }; skippedImageUrls: string[] }>(create, 201);
    expect(created.skippedImageUrls).toEqual([priv]);
    expect(await storedUrls(created.quote.id)).toEqual([]);

    const add = await page.request.post(`/api/v2/quotes/${refusedOnUpdate.deal.entityId}/images`, { data: { images: ["https://images.e2e.test/z.jpg"] } });
    expect(add.status()).toBe(201);
  });
});

test.describe("a gallery with a legacy image string no longer fails the copy", () => {
  const good = "https://images.e2e.test/good.jpg";
  const legacy = "//cdn.e2e.test/legacy.jpg";

  test("copying a quote with one bad gallery url succeeds and skips it (add-quote, duplicate and copy-to-client)", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await quoteDeal(page.request, w, { title: "Gallery source" });

    // Add a copy to the deal.
    const copy = await page.request.post("/api/v2/quotes", {
      data: { ...quotePayload(w.agency, { title: "Gallery copy" }), transaction_id: deal.transactionId, isQuoteCopy: true, images: [good, legacy, null] },
    });
    const copied = await dataOf<{ id: string; skippedImageUrls: string[] }>(copy, 201);
    expect(copied.skippedImageUrls).toEqual([legacy, "(not an image link)"]);
    expect(await storedUrls(copied.id)).toEqual([good]);

    // Duplicate a quote whose stored gallery already holds a legacy value and a null url.
    await queryRows(`insert into quote_images (id, quote_id, url, is_primary, position) values (gen_random_uuid()::text, $1, $2, false, 1), (gen_random_uuid()::text, $1, null, false, 2), (gen_random_uuid()::text, $1, $3, false, 0)`, [deal.entityId, legacy, good]);
    const dup = await page.request.post(`/api/v2/quotes/${deal.entityId}/duplicate`, { data: {} });
    const duplicated = await dataOf<{ id: string; skippedImageUrls: string[] }>(dup, 201);
    expect(duplicated.skippedImageUrls).toEqual([legacy]);
    expect(await storedUrls(duplicated.id)).toEqual([good]);

    // Copy to client: a brand-new deal from a gallery with a bare www. url.
    const toClient = await page.request.post("/api/v2/transactions", {
      data: { client_id: w.clientId, user_id: w.userId, quote: { ...quotePayload(w.agency, { title: "Copy to client" }), images: [good, "www.cdn.e2e.test/x.jpg"] } },
    });
    const made = await dataOf<{ quote: { id: string }; skippedImageUrls: string[] }>(toClient, 201);
    expect(made.skippedImageUrls).toEqual(["www.cdn.e2e.test/x.jpg"]);
    expect(await storedUrls(made.quote.id)).toEqual([good]);
  });

  test("editing a quote whose gallery already holds a legacy url still works (only new strings are checked)", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await quoteDeal(page.request, w, { title: "Legacy gallery" });
    await queryRows(`insert into quote_images (id, quote_id, url, is_primary, position) values (gen_random_uuid()::text, $1, $2, false, 0)`, [deal.entityId, legacy]);
    const edit = await page.request.patch(`/api/v2/quotes/${deal.entityId}`, { data: { title: "Renamed" } });
    expect(edit.status(), await edit.text()).toBe(200);
    const addNew = await page.request.patch(`/api/v2/quotes/${deal.entityId}`, { data: { images: [good] } });
    expect(addNew.status(), await addNew.text()).toBe(200);
    const typedBad = await page.request.patch(`/api/v2/quotes/${deal.entityId}`, { data: { images: [legacy] } });
    expect(typedBad.status()).toBe(400);
  });
});

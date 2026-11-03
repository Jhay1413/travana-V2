/**
 * B1: the quote and booking image endpoints are scoped like the quote and booking themselves.
 * Writes (add, delete, reorder, set primary) use the shop-pinned write scope: another shop's deal in the same agency
 * answers 403 "This deal belongs to another shop"; another agency's deal answers 404 for everything, reads included.
 * Reads of another shop's deal stay agency-wide (200). Shared hotel-gallery (accommodation / lodge) images are master
 * records and can never be deleted through a quote or booking.
 */
import type { APIRequestContext } from "@playwright/test";
import { dataOf, signIn } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { bookingImageRows, quoteImageRows, shopsWorld, type ShopsWorld } from "../helpers/shops";
import { queryRows } from "../helpers/seed";

const IMG_A = "https://images.e2e.test/a.jpg";
const IMG_B = "https://images.e2e.test/b.jpg";
const OTHER_SHOP = "This deal belongs to another shop";

async function addQuoteImages(request: APIRequestContext, quoteId: string, images: string[]) {
  return request.post(`/api/v2/quotes/${quoteId}/images`, { data: { images } });
}

/** Shop 2's agent gives the shop-2 quote two images and the shop-2 booking two images; returns their row ids. */
async function seedGalleries(page: import("@playwright/test").Page, o: ShopsWorld) {
  await signIn(page, o.agent2.email);
  const q = await dataOf<{ id: string }[]>(await addQuoteImages(page.request, o.deal2.entityId, [IMG_A, IMG_B]), 201);
  const b = await dataOf<{ id: string }[]>(await page.request.post(`/api/v2/bookings/${o.booked2.bookingId}/images`, { data: { images: [IMG_A, IMG_B] } }), 201);
  return { quoteImageIds: q.map((i) => i.id), bookingImageIds: b.map((i) => i.id) };
}

test.describe("quote images", () => {
  test("another shop's agent can read the gallery but gets 403 on add, delete, reorder and set-primary; nothing changes", async ({ page }) => {
    const o = await shopsWorld(page);
    const g = await seedGalleries(page, o);
    const before = await quoteImageRows(o.deal2.entityId);
    await signIn(page, o.w.agency.agentEmail); // shop 1

    expect((await page.request.get(`/api/v2/quotes/${o.deal2.entityId}/images`)).status(), "reads stay agency-wide").toBe(200);
    const q = o.deal2.entityId;
    const attempts: Array<[string, () => Promise<import("@playwright/test").APIResponse>]> = [
      ["add", () => addQuoteImages(page.request, q, [IMG_A])],
      ["delete", () => page.request.delete(`/api/v2/quotes/${q}/images/${g.quoteImageIds[0]}`)],
      ["reorder", () => page.request.patch(`/api/v2/quotes/${q}/images/order`, { data: { imageIds: [g.quoteImageIds[1], g.quoteImageIds[0]] } })],
      ["set primary", () => page.request.patch(`/api/v2/quotes/${q}/images/${g.quoteImageIds[1]}/primary`, { data: {} })],
    ];
    for (const [name, call] of attempts) {
      const res = await call();
      expect(res.status(), `${name}: ${await res.text()}`).toBe(403);
      expect(await res.text()).toContain(OTHER_SHOP);
    }
    expect(await quoteImageRows(q)).toEqual(before);
  });

  test("another agency gets 404 on everything, reads included, and nothing changes", async ({ page }) => {
    const o = await shopsWorld(page);
    const g = await seedGalleries(page, o);
    const before = await quoteImageRows(o.deal2.entityId);
    await signIn(page, o.foreign.agentEmail);
    const q = o.deal2.entityId;
    const calls = [
      page.request.get(`/api/v2/quotes/${q}/images`),
      addQuoteImages(page.request, q, [IMG_A]),
      page.request.delete(`/api/v2/quotes/${q}/images/${g.quoteImageIds[0]}`),
      page.request.patch(`/api/v2/quotes/${q}/images/order`, { data: { imageIds: [g.quoteImageIds[1], g.quoteImageIds[0]] } }),
      page.request.patch(`/api/v2/quotes/${q}/images/${g.quoteImageIds[1]}/primary`, { data: {} }),
    ];
    for (const res of await Promise.all(calls)) expect(res.status(), await res.text()).toBe(404);
    expect(await quoteImageRows(q)).toEqual(before);
  });

  test("controls: the owning shop and the org admin can add, reorder, set primary and delete", async ({ page }) => {
    const o = await shopsWorld(page);
    const g = await seedGalleries(page, o);
    const q = o.deal2.entityId;
    // owning shop
    expect((await page.request.patch(`/api/v2/quotes/${q}/images/order`, { data: { imageIds: [g.quoteImageIds[1], g.quoteImageIds[0]] } })).status()).toBe(200);
    expect((await page.request.patch(`/api/v2/quotes/${q}/images/${g.quoteImageIds[1]}/primary`, { data: {} })).status()).toBe(200);
    // org admin (org-wide)
    await signIn(page, o.agency.adminEmail);
    expect((await addQuoteImages(page.request, q, ["https://images.e2e.test/c.jpg"])).status()).toBe(201);
    expect((await page.request.delete(`/api/v2/quotes/${q}/images/${g.quoteImageIds[0]}`)).status()).toBe(200);
    expect((await quoteImageRows(q)).map((r) => r.id)).not.toContain(g.quoteImageIds[0]);
  });

  test("a shared hotel-gallery image is refused with 400 and the master row survives", async ({ page }) => {
    const o = await shopsWorld(page);
    const [{ id: masterId }] = await queryRows<{ id: string }>(
      `insert into accommodation_images (accommodation_id, image_url) values ($1, $2) returning id`,
      [o.agency.ref.accommodation, `https://images.e2e.test/hotel-master-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`],
    );
    await signIn(page, o.agent2.email);
    const res = await page.request.delete(`/api/v2/quotes/${o.deal2.entityId}/images/${masterId}`);
    expect(res.status(), await res.text()).toBe(400);
    expect(await res.text()).toContain("shared hotel gallery");
    expect((await queryRows(`select 1 from accommodation_images where id = $1`, [masterId])).length, "the master row is still there").toBe(1);
    // The quote edit form's deletedImageIds is skipped for it too: saving the quote does not delete the master row.
    const save = await page.request.patch(`/api/v2/quotes/${o.deal2.entityId}`, { data: { deletedImageIds: [masterId] } });
    expect(save.status(), await save.text()).toBe(200);
    expect((await queryRows(`select 1 from accommodation_images where id = $1`, [masterId])).length).toBe(1);
  });
});

test.describe("booking images", () => {
  test("another shop's agent can read but gets 403 on add, delete, reorder and set-primary; another agency gets 404 on all", async ({ page }) => {
    const o = await shopsWorld(page);
    const g = await seedGalleries(page, o);
    const before = await bookingImageRows(o.booked2.bookingId);
    const b = o.booked2.bookingId;
    const run = async () => [
      ["get", await page.request.get(`/api/v2/bookings/${b}/images`)],
      ["add", await page.request.post(`/api/v2/bookings/${b}/images`, { data: { images: [IMG_A] } })],
      ["delete", await page.request.delete(`/api/v2/bookings/${b}/images/${g.bookingImageIds[0]}`)],
      ["reorder", await page.request.patch(`/api/v2/bookings/${b}/images/order`, { data: { imageIds: [g.bookingImageIds[1], g.bookingImageIds[0]] } })],
      ["set primary", await page.request.patch(`/api/v2/bookings/${b}/images/${g.bookingImageIds[1]}/primary`, { data: {} })],
    ] as const;

    await signIn(page, o.w.agency.agentEmail); // shop 1
    for (const [name, res] of await run()) {
      expect(res.status(), `${name}: ${await res.text()}`).toBe(name === "get" ? 200 : 403);
    }
    await signIn(page, o.foreign.agentEmail);
    for (const [name, res] of await run()) expect(res.status(), `${name}: ${await res.text()}`).toBe(404);
    expect(await bookingImageRows(b)).toEqual(before);

    // Controls
    await signIn(page, o.agent2.email);
    expect((await page.request.patch(`/api/v2/bookings/${b}/images/${g.bookingImageIds[1]}/primary`, { data: {} })).status()).toBe(200);
    expect((await page.request.delete(`/api/v2/bookings/${b}/images/${g.bookingImageIds[0]}`)).status()).toBe(200);
  });

  test("a shared hotel-gallery image is refused with 400 through a booking too", async ({ page }) => {
    const o = await shopsWorld(page);
    const [{ id: masterId }] = await queryRows<{ id: string }>(
      `insert into accommodation_images (accommodation_id, image_url) values ($1, $2) returning id`,
      [o.agency.ref.accommodation, `https://images.e2e.test/hotel-master-b-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`],
    );
    await signIn(page, o.agent2.email);
    const res = await page.request.delete(`/api/v2/bookings/${o.booked2.bookingId}/images/${masterId}`);
    expect(res.status(), await res.text()).toBe(400);
    expect((await queryRows(`select 1 from accommodation_images where id = $1`, [masterId])).length).toBe(1);
  });
});

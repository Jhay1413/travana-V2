/**
 * Two-host run: the old portal notifications on the staff host are retired, the portal host keeps the normal worker.
 *
 * A real push subscription needs the browser vendor's push service, which the outbound block forbids, so the worker's
 * subscription handling is proved by the unit test (a fake registration) and here we prove what a browser can: the right
 * script is served on each host, a worker registered on the staff host removes itself, and the server's retire endpoint
 * deletes a subscription only for the exact endpoint + keys, with no session.
 */
import { randomUUID } from "node:crypto";
import { BASE_URL, PORTAL_ORIGIN } from "../helpers/env";
import { expect, test } from "../helpers/fixtures";
import { seedPortalCustomer } from "../helpers/portal";
import { queryRows } from "../helpers/seed";

test.describe("portal service worker per host", () => {
  test("the staff host serves the retire worker, the portal host the normal one", async ({ page }) => {
    await page.goto(`${BASE_URL}/favicon.png`);
    const staff = await page.evaluate(async () => (await fetch("/portal-sw.js")).text());
    expect(staff).toContain("/api/v2/portal/push/retire");
    expect(staff).toContain("unregister");
    expect(staff).not.toContain("showNotification");

    await page.goto(`${PORTAL_ORIGIN}/favicon.png`);
    const portal = await page.evaluate(async () => (await fetch("/portal-sw.js")).text());
    expect(portal).toContain("showNotification");
    expect(portal).not.toContain("push/retire");
  });

  test("a worker installed from the old address removes itself", async ({ page }) => {
    await page.goto(`${BASE_URL}/favicon.png`);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register("/portal-sw.js");
    });
    await expect
      .poll(async () => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), { timeout: 20_000 })
      .toBe(0);
  });
});

test.describe("POST /api/v2/portal/push/retire (no session)", () => {
  async function subscriptionFor(clientId: string): Promise<{ endpoint: string; p256dh: string; auth: string }> {
    const sub = { endpoint: `https://push.example.test/${randomUUID()}`, p256dh: `p-${randomUUID()}`, auth: `a-${randomUUID()}` };
    await queryRows(`insert into push_subscriptions (client_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)`, [clientId, sub.endpoint, sub.p256dh, sub.auth]);
    return sub;
  }
  const rows = (endpoint: string) => queryRows(`select 1 from push_subscriptions where endpoint = $1`, [endpoint]);

  test("deletes only the subscription whose endpoint and both keys match", async ({ page }) => {
    const c = await seedPortalCustomer();
    const sub = await subscriptionFor(c.clientId);

    for (const wrong of [{ ...sub, auth: "nope" }, { ...sub, p256dh: "nope" }]) {
      const res = await page.request.post(`${BASE_URL}/api/v2/portal/push/retire`, { data: { subscription: { endpoint: wrong.endpoint, keys: { p256dh: wrong.p256dh, auth: wrong.auth } } } });
      expect(res.status()).toBe(200);
      expect(await rows(sub.endpoint)).toHaveLength(1);
    }
    // An endpoint alone is refused outright: there is no delete-by-id.
    const bare = await page.request.post(`${BASE_URL}/api/v2/portal/push/retire`, { data: { endpoint: sub.endpoint } });
    expect(bare.status()).toBeGreaterThanOrEqual(400);
    expect(await rows(sub.endpoint)).toHaveLength(1);

    const ok = await page.request.post(`${BASE_URL}/api/v2/portal/push/retire`, { data: { subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } } } });
    expect(ok.status()).toBe(200);
    expect(await rows(sub.endpoint)).toHaveLength(0);
  });
});

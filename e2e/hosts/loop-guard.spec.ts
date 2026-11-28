/**
 * Two-host run: the redirect-loop guard and the owner's switch-over check (GET /api/v2/portal/host-check).
 *
 * A proxy that does not forward the original host is simulated with an X-Forwarded-Host header on every request: the
 * server then believes it was asked on the STAFF host even when the browser is on the portal host, which is exactly the
 * situation that would send /portal to itself forever. The guard serves the page instead (as single-host) after two
 * redirects, and logs the mistake once.
 */
import { BASE_URL, PORTAL_ORIGIN, E2E_PORT } from "../helpers/env";
import { expect, test } from "../helpers/fixtures";
import { randomIp } from "../helpers/seed";

const LOST_HOST = { "X-Forwarded-Host": `localhost:${E2E_PORT}` };

test.describe("host-check", () => {
  test("says kind portal with the portal host name on the portal address, and staff on the staff address", async ({ page }) => {
    await page.goto(`${PORTAL_ORIGIN}/portal/login`);
    const portal = await page.evaluate(async () => (await fetch("/api/v2/portal/host-check")).json());
    expect(portal).toEqual({ kind: "portal", hostSeen: "portal.localhost" });

    await page.goto(`${BASE_URL}/`);
    const staff = await page.evaluate(async () => (await fetch("/api/v2/portal/host-check")).json());
    expect(staff).toEqual({ kind: "staff", hostSeen: "localhost" });
  });
});

test.describe("a proxy that loses the original host", () => {
  test.use({ extraHTTPHeaders: { ...LOST_HOST, "X-Forwarded-For": randomIp() } });

  test("host-check shows the problem (kind staff on the portal address)", async ({ page }) => {
    // Straight to the API: a page request would be redirected first.
    const res = await page.request.get(`${BASE_URL}/api/v2/portal/host-check`);
    expect(await res.json()).toEqual({ kind: "staff", hostSeen: "localhost" });
  });

  test("the portal page still opens (no endless redirect) and the page says it is single-host", async ({ page }) => {
    const response = await page.goto(`${PORTAL_ORIGIN}/portal/login?org=x`);
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).origin).toBe(PORTAL_ORIGIN);
    await expect(page.getByTestId("input-email")).toBeVisible();
    const hosts = JSON.parse((await page.locator('meta[name="travana-hosts"]').getAttribute("content")) ?? "{}");
    expect(hosts).toEqual({ portal: "", staff: "", kind: "single" });
  });
});

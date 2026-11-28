/**
 * Two-host run (npm run test:e2e:hosts): the staff CRM is http://localhost:5057 and the customer portal plus the public
 * quote page are http://portal.localhost:5057 (same app, same server, PORTAL_BASE_URL set). Nothing here runs in the main
 * suite, which stays single-host.
 *
 * Covers: old links on the staff host still work (they redirect, path and query intact), the staff preview stays on the
 * staff host, staff pages and staff APIs are not reachable on the portal host, the portal and public quote APIs are,
 * the root goes to /portal, no open redirect, static files on both hosts, anti-framing headers, the hosts tag the page
 * carries, and that a name other than portal.localhost still does not resolve.
 */
import { randomBytes } from "node:crypto";
import { test as bare } from "@playwright/test";
import { BASE_URL, PORTAL_ORIGIN } from "../helpers/env";
import { expect, test } from "../helpers/fixtures";
import { mintLoginCode, seedPortalCustomer } from "../helpers/portal";
import { seedPortalQuote, seedPortalQuoteWorld } from "../helpers/portal-quotes";
import { queryRows } from "../helpers/seed";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const newToken = () => Array.from(randomBytes(20), (b) => ALPHABET[b % ALPHABET.length]).join("");

/** Fetches from inside the page, so the browser resolves the host name (the test runner never has to). */
async function statusAndBody(page: import("@playwright/test").Page, path: string, init?: { method?: string }): Promise<{ status: number; body: string }> {
  return page.evaluate(
    async ([p, method]) => {
      const res = await fetch(p, { method, redirect: "manual" });
      return { status: res.status, body: await res.text() };
    },
    [path, init?.method ?? "GET"] as const,
  );
}

test.describe("old links on the staff host", () => {
  test("a sign-in link sent before the move answers 302 to the portal host with the code and next intact", async ({ page }) => {
    const url = `/portal/login?mt=ABCDEFGH2345&next=${encodeURIComponent("/portal/quote/TOK")}`;
    const res = await page.request.get(`${BASE_URL}${url}`, { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()["location"]).toBe(`${PORTAL_ORIGIN}${url}`);
    expect(res.headers()["referrer-policy"]).toBe("no-referrer");
    expect(res.headers()["cache-control"]).toBe("no-store");
  });

  test("it lands the customer signed in on the portal host and spends the code", async ({ page }) => {
    const c = await seedPortalCustomer();
    const code = await mintLoginCode(c.clientId);
    await page.addInitScript(() => localStorage.setItem("portal_setup_wizard_done", "1"));

    await page.goto(`${BASE_URL}/portal/login?mt=${code}&next=${encodeURIComponent("/portal/account")}`);
    await page.waitForURL((u) => u.origin === PORTAL_ORIGIN && u.pathname === "/portal/account");
    await expect(page.getByTestId("portal-account")).toBeVisible();
    expect(page.url()).not.toContain("mt=");
    expect(await page.evaluate(() => localStorage.getItem("portal_token"))).toBeTruthy();
    expect(await queryRows(`select 1 from portal_login_tokens where code = $1 and used = true`, [code])).toHaveLength(1);
  });

  test("any /portal path on the staff host redirects, and /view-quote/<token> redirects and opens", async ({ page }) => {
    const q = await seedPortalQuoteWorld(page);
    const token = newToken();
    await seedPortalQuote(page, q, { title: "Hotel Playa Azul Majorca", token });

    const portalRes = await page.request.get(`${BASE_URL}/portal/bookings?x=1`, { maxRedirects: 0 });
    expect(portalRes.status()).toBe(302);
    expect(portalRes.headers()["location"]).toBe(`${PORTAL_ORIGIN}/portal/bookings?x=1`);

    await page.goto(`${BASE_URL}/view-quote/${token}`);
    await page.waitForURL((u) => u.origin === PORTAL_ORIGIN && u.pathname === `/view-quote/${token}`);
    await expect(page.getByTestId("page-public-quote")).toBeVisible();
    await expect(page.getByTestId("text-quote-title")).toContainText("Hotel Playa Azul Majorca");
  });

  test("the staff preview (?preview=1) stays on the staff host, and the portal host sends it back there", async ({ page }) => {
    const q = await seedPortalQuoteWorld(page);
    const token = newToken();
    await seedPortalQuote(page, q, { title: "Hotel Playa Azul Majorca", token });

    await page.goto(`${BASE_URL}/view-quote/${token}?preview=1`);
    expect(new URL(page.url()).origin).toBe(BASE_URL);
    await expect(page.getByTestId("page-public-quote")).toBeVisible();

    await page.goto(`${PORTAL_ORIGIN}/view-quote/${token}?preview=1`);
    await page.waitForURL((u) => u.origin === BASE_URL && u.pathname === `/view-quote/${token}` && u.search === "?preview=1");
    await expect(page.getByTestId("page-public-quote")).toBeVisible();
  });
});

test.describe("the portal host", () => {
  test("its root goes to /portal", async ({ page }) => {
    await page.goto(`${PORTAL_ORIGIN}/`);
    await page.waitForURL((u) => u.origin === PORTAL_ORIGIN && (u.pathname === "/portal" || u.pathname === "/portal/login"));
  });

  test("staff pages bounce to the staff host, on a page load and on an in-app navigation", async ({ page }) => {
    await page.goto(`${PORTAL_ORIGIN}/clients?tab=all`);
    await page.waitForURL((u) => u.origin === BASE_URL && u.pathname === "/clients" && u.search === "?tab=all");

    // The route guard in the app: a soft navigation to a staff path on the portal host is replaced as well.
    await page.goto(`${PORTAL_ORIGIN}/portal/login`);
    await page.evaluate(() => history.pushState(null, "", "/pipeline"));
    await page.waitForURL((u) => u.origin === BASE_URL && u.pathname === "/pipeline");
  });

  test("a staff API is a 404 { error: 'Not found' } and the portal and public quote APIs answer", async ({ page }) => {
    const c = await seedPortalCustomer();
    await page.goto(`${PORTAL_ORIGIN}/portal/login`);

    for (const [path, method] of [["/api/auth/user", "GET"], ["/api/v2/clients", "GET"], ["/api/auth/login", "POST"], ["/API/V2/CLIENTS", "GET"]] as const) {
      const r = await statusAndBody(page, path, { method });
      expect(r.status, `${method} ${path}`).toBe(404);
      expect(JSON.parse(r.body)).toEqual({ error: "Not found" });
    }

    // Portal and public quote APIs reach their own routers (which have their own answers, not the host's 404).
    expect((await statusAndBody(page, `/api/v2/portal/branding/${c.slug}`)).status).toBe(200);
    expect((await statusAndBody(page, "/api/portal/messages")).status).toBe(401);
    const missingQuote = await statusAndBody(page, "/api/public/quote/NOPE0000");
    expect(missingQuote.status).toBe(404);
    expect(JSON.parse(missingQuote.body)).toMatchObject({ message: "Quote not found" });
  });

  test("on the staff host every API is still reachable (old installed portal copies call /api/portal)", async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    expect((await statusAndBody(page, "/api/auth/user")).status).toBe(401);
    expect((await statusAndBody(page, "/api/portal/messages")).status).toBe(401);
  });

  test("an open-redirect attempt is answered 404, never a redirect", async ({ page }) => {
    await page.goto(`${PORTAL_ORIGIN}/portal/login`);
    for (const path of ["//evil.example", "//evil.example/portal", "/\\evil.example"]) {
      const r = await page.evaluate(async (p) => {
        const res = await fetch(`${location.origin}${p}`, { redirect: "manual" });
        return { status: res.status, type: res.type };
      }, path);
      expect(r, path).toEqual({ status: 404, type: "basic" });
    }
  });

  test("static files are served on both hosts", async ({ page }) => {
    for (const origin of [BASE_URL, PORTAL_ORIGIN]) {
      await page.goto(`${origin}/favicon.png`);
      for (const file of ["/manifest.json", "/portal-sw.js", "/favicon.png"]) {
        const r = await page.evaluate(async (f) => (await fetch(f, { redirect: "manual" })).status, file);
        expect(r, `${origin}${file}`).toBe(200);
      }
    }
  });

  test("portal pages cannot be framed, staff pages are untouched, and the page says which host it is on", async ({ page }) => {
    const portal = await page.goto(`${PORTAL_ORIGIN}/portal/login`);
    expect(portal?.headers()["x-frame-options"]).toBe("DENY");
    expect(portal?.headers()["content-security-policy"]).toBe("frame-ancestors 'none'");
    const portalHosts = JSON.parse((await page.locator('meta[name="travana-hosts"]').getAttribute("content")) ?? "{}");
    expect(portalHosts).toEqual({ portal: PORTAL_ORIGIN, staff: BASE_URL, kind: "portal" });

    const staff = await page.goto(`${BASE_URL}/`);
    expect(staff?.headers()["x-frame-options"]).toBeUndefined();
    const staffHosts = JSON.parse((await page.locator('meta[name="travana-hosts"]').getAttribute("content")) ?? "{}");
    expect(staffHosts).toEqual({ portal: PORTAL_ORIGIN, staff: BASE_URL, kind: "staff" });
  });

  test("the portal host's customers never call the staff session check", async ({ page }) => {
    const staffCalls: string[] = [];
    page.on("request", (r) => {
      if (r.url().startsWith(`${PORTAL_ORIGIN}/api/auth/`)) staffCalls.push(r.url());
    });
    await page.goto(`${PORTAL_ORIGIN}/portal/login`);
    await expect(page.getByTestId("input-email")).toBeVisible();
    expect(staffCalls).toEqual([]);
  });
});

// Not through the shared fixtures: this proves the browser's own resolver rule, and a request that never leaves the
// machine must not be recorded as a violation by the route guard.
bare.describe("the outbound block still holds in the two-host run", () => {
  bare("portal.localhost resolves but any other host name does not", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await expect(page.goto("http://other.localhost:5057/")).rejects.toThrow(/ERR_NAME_NOT_RESOLVED/);
    await expect(page.goto("http://evil.example/")).rejects.toThrow(/ERR_NAME_NOT_RESOLVED/);
    const ok = await page.goto(`${PORTAL_ORIGIN}/favicon.png`);
    expect(ok?.status()).toBe(200);
    await context.close();
  });
});

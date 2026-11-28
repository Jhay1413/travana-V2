/**
 * Two-host run: link previews per route, and quote / agency images on the portal host.
 *
 * Previews: the portal host (and, in a single-host set-up, /portal and /view-quote only) serve neutral customer-facing tags;
 * the staff host keeps the platform's own. The agency name is the only thing a quote link reveals, and only for a quote the
 * public link would open; booked, unknown and malformed tokens are neutral. Every value is HTML-escaped.
 *
 * Images: stored image addresses are site-relative, so they are fetched from the portal host itself. Quote photos and the
 * agency logo here are static files (the E2E database has no S3); the image proxy /api/v2/files/img is proved to reach its
 * own handler (not the portal host's 404) with keys that need no S3.
 */
import { randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";
import { BASE_URL, PORTAL_ORIGIN } from "../helpers/env";
import { expect, test } from "../helpers/fixtures";
import { bookedDeal } from "../helpers/pipeline";
import { seedPortalQuote, seedPortalQuoteWorld } from "../helpers/portal-quotes";
import { queryRows } from "../helpers/seed";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const newToken = () => Array.from(randomBytes(20), (b) => ALPHABET[b % ALPHABET.length]).join("");

/** The HTML a browser at `origin` gets for `path`, read from inside a page on that origin. */
async function htmlFor(page: Page, origin: string, path: string): Promise<string> {
  await page.goto(`${origin}/favicon.png`);
  return page.evaluate(async (p) => (await fetch(p, { redirect: "manual" })).text(), path);
}

const tag = (html: string, selector: RegExp): string | null => selector.exec(html)?.[1] ?? null;
const ogTitle = (html: string) => tag(html, /<meta property="og:title" content="([^"]*)"/);

test.describe("link previews", () => {
  test("an open quote names the agency only; blocked, unknown and portal pages are neutral; staff pages keep the platform's tags", async ({ page }) => {
    const q = await seedPortalQuoteWorld(page);
    const token = newToken();
    await seedPortalQuote(page, q, { title: "Hotel Playa Azul Majorca", token, salesPrice: "2400.00" });
    await queryRows(`update organization set name = $2, logo_url = '/favicon.png' where id = $1`, [q.portal.orgId, `Sunny & "Co" <b>Travel</b>`]);

    const open = await htmlFor(page, PORTAL_ORIGIN, `/view-quote/${token}`);
    expect(ogTitle(open)).toBe("Sunny &amp; &quot;Co&quot; &lt;b&gt;Travel&lt;/b&gt; — your holiday quote");
    expect(tag(open, /<meta property="og:description" content="([^"]*)"/)).toBe("Open to see the details.");
    expect(tag(open, /<meta property="og:image" content="([^"]*)"/)).toBe(`${PORTAL_ORIGIN}/favicon.png`);
    expect(open).toContain('<meta name="robots" content="noindex" />');
    expect(open).not.toContain("<b>Travel</b>");
    // Nothing about the holiday, the price, the customer or the agent.
    expect(open).not.toMatch(/Playa Azul|Majorca|2,?400|Pat\b/);
    expect(open).not.toContain("Operating System for Travel Agents");

    const unknown = await htmlFor(page, PORTAL_ORIGIN, `/view-quote/${newToken()}`);
    expect(ogTitle(unknown)).toBe("Your holiday portal");
    expect(unknown).not.toContain("Sunny");

    const portalPage = await htmlFor(page, PORTAL_ORIGIN, "/portal/login");
    expect(ogTitle(portalPage)).toBe("Your holiday portal");
    expect(portalPage).toContain('content="noindex"');

    const staffPage = await htmlFor(page, BASE_URL, "/");
    expect(ogTitle(staffPage)).toContain("The Operating System for Travel Agents");
    expect(staffPage).not.toContain("noindex");
  });

  test("a booked quote reveals no agency", async ({ page }) => {
    const q = await seedPortalQuoteWorld(page);
    const trip = await bookedDeal(page.request, q.world, { title: "Booked Barbados Week", travel_date: "2027-03-10", num_of_nights: 7, adult: 2 });
    const token = newToken();
    await queryRows(`update quote_table set quote_token = $1 where id = $2`, [token, trip.entityId]);
    const html = await htmlFor(page, PORTAL_ORIGIN, `/view-quote/${token}`);
    expect(ogTitle(html)).toBe("Your holiday portal");
    expect(html).not.toContain("Barbados");
  });
});

test.describe("images on the portal host", () => {
  test("quote photos and the agency logo load on the public quote page", async ({ page }) => {
    const q = await seedPortalQuoteWorld(page);
    const token = newToken();
    await seedPortalQuote(page, q, { title: "Hotel Playa Azul Majorca", token, itinerary: true });
    await queryRows(`update organization set logo_url = '/favicon.png' where id = $1`, [q.portal.orgId]);

    await page.goto(`${PORTAL_ORIGIN}/view-quote/${token}`);
    await expect(page.getByTestId("page-public-quote")).toBeVisible();
    const logo = page.getByTestId("public-quote-header").getByTestId("portal-agency-logo");
    await expect(logo).toBeVisible();
    await expect.poll(async () => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

    const photo = page.getByTestId("quote-photo-0");
    if ((await photo.count()) > 0) {
      const img = photo.locator("img").first();
      await expect.poll(async () => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    }
  });

  test("the image proxy reaches its own handler on the portal host, and is read-only there", async ({ page }) => {
    await page.goto(`${PORTAL_ORIGIN}/favicon.png`);
    const probe = (path: string, method = "GET") =>
      page.evaluate(
        async ([p, m]) => {
          const res = await fetch(p, { method: m, redirect: "manual" });
          return { status: res.status, body: await res.text() };
        },
        [path, method] as const,
      );

    const noKey = await probe("/api/v2/files/img");
    expect(noKey.status).toBe(400);
    expect(JSON.parse(noKey.body)).toMatchObject({ message: "key query parameter is required" });

    const private_ = await probe("/api/v2/files/img?key=client-files%2Fsecret.pdf");
    expect(private_.status).toBe(404);
    expect(JSON.parse(private_.body)).toMatchObject({ message: "Image not found" });

    const post = await probe("/api/v2/files/img?key=quote-images%2Fa.jpg", "POST");
    expect(post.status).toBe(404);
    expect(JSON.parse(post.body)).toEqual({ error: "Not found" });
  });
});

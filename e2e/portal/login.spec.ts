import { OUTBOUND_LOG } from "../helpers/env";
import { expect, test } from "../helpers/fixtures";
import { readOutboundAttempts } from "../helpers/outbound-report";
import { mintLoginCode, seedPortalCustomer, startSignedIn } from "../helpers/portal";
import { queryRows, unique } from "../helpers/seed";

async function bearer(page: import("@playwright/test").Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem("portal_token"));
  return `Bearer ${token}`;
}

const TABS = ["home", "trips", "deals", "messages", "account"] as const;

test.describe("customer portal: sign-in", () => {
  test("a PIN sign-in lands on Home with the five tabs and no fixed brand name", async ({ page }) => {
    const c = await seedPortalCustomer({ logoUrl: "/favicon.png" });
    await page.addInitScript(() => localStorage.setItem("portal_setup_wizard_done", "1"));

    await page.goto(`/portal/login?org=${c.slug}`);
    await page.getByTestId("input-email").fill(c.email);
    await page.getByTestId("input-pin").fill(c.pin);
    await page.getByTestId("button-login").click();

    await expect(page).toHaveURL(/\/portal$/);
    const nav = page.getByTestId("nav-bottom");
    await expect(nav).toBeVisible();
    for (const key of TABS) await expect(page.getByTestId(`nav-tab-${key}`)).toBeVisible();
    await expect(nav.getByRole("button")).toHaveCount(5);
    await expect(page.getByTestId("nav-tab-home")).toHaveAttribute("aria-current", "page");
    // The header and footer come from the agency's data.
    await expect(page.getByTestId("portal-header-home").getByAltText(c.orgName)).toBeVisible();
    await expect(page.getByTestId("portal-footer")).toContainText(c.orgName);
    await expect(page.getByTestId("portal-footer")).toContainText("01234 567890");
  });

  test("a wrong PIN shows the same generic message a made-up email gets", async ({ page }) => {
    const c = await seedPortalCustomer();
    await page.goto(`/portal/login?org=${c.slug}`);

    await page.getByTestId("input-email").fill(c.email);
    await page.getByTestId("input-pin").fill("1111");
    await page.getByTestId("button-login").click();
    await expect(page.getByTestId("text-error")).toHaveText("Incorrect email or PIN");

    await page.getByTestId("input-email").fill(`ghost-${unique("g")}@e2e.test`);
    await page.getByTestId("input-pin").fill("1111");
    await page.getByTestId("button-login").click();
    await expect(page.getByTestId("text-error")).toHaveText("Incorrect email or PIN");
    await expect(page).toHaveURL(/\/portal\/login/);
  });

  test("five wrong PINs pause PIN sign-in, and the right PIN is refused too while it is paused", async ({ page }) => {
    const c = await seedPortalCustomer();
    await page.goto(`/portal/login?org=${c.slug}`);
    await page.getByTestId("input-email").fill(c.email);

    for (const wrong of ["1111", "2222", "3333", "4444", "5555"]) {
      await page.getByTestId("input-pin").fill(wrong);
      await page.getByTestId("button-login").click();
      await expect(page.getByTestId("text-error")).toHaveText("Incorrect email or PIN");
    }

    await page.getByTestId("input-pin").fill("6666");
    await page.getByTestId("button-login").click();
    await expect(page.getByTestId("text-error")).toContainText("paused for 15 minutes");

    await page.getByTestId("input-pin").fill(c.pin);
    await page.getByTestId("button-login").click();
    await expect(page.getByTestId("text-error")).toContainText("paused for 15 minutes");
    await expect(page).toHaveURL(/\/portal\/login/);
  });

  test("the PIN field is a masked numeric field with a show/hide toggle", async ({ page }) => {
    const c = await seedPortalCustomer();
    await page.goto(`/portal/login?org=${c.slug}`);
    const pin = page.getByTestId("input-pin");
    await expect(pin).toHaveAttribute("inputmode", "numeric");
    await expect(pin).toHaveAttribute("autocomplete", "current-password");
    await expect(pin).toHaveAttribute("type", "password");
    await pin.fill("12ab34567");
    await expect(pin).toHaveValue("1234");
    await page.getByTestId("button-toggle-pin").click();
    await expect(pin).toHaveAttribute("type", "text");
  });
});

test.describe("customer portal: navigation", () => {
  test("the tabs, the Trips segments and the old /portal/quotes and /portal/bookings URLs", async ({ page }) => {
    const c = await seedPortalCustomer();
    await startSignedIn(page, c);

    await page.goto("/portal");
    await expect(page.getByTestId("nav-tab-home")).toHaveAttribute("aria-current", "page");

    await page.getByTestId("nav-tab-trips").click();
    await expect(page).toHaveURL(/\/portal\/trips\/quotes$/);
    await expect(page.getByTestId("nav-tab-trips")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("trips-segment-quotes")).toHaveAttribute("aria-current", "page");

    await page.getByTestId("trips-segment-bookings").click();
    await expect(page).toHaveURL(/\/portal\/trips\/bookings$/);
    await expect(page.getByTestId("trips-segment-bookings")).toHaveAttribute("aria-current", "page");
    // The hosted page does not draw a second shell.
    await expect(page.getByTestId("nav-bottom")).toHaveCount(1);

    await page.getByTestId("nav-tab-deals").click();
    await expect(page).toHaveURL(/\/portal\/deals$/);
    await expect(page.getByTestId("nav-tab-deals")).toHaveAttribute("aria-current", "page");

    await page.getByTestId("nav-tab-messages").click();
    await expect(page).toHaveURL(/\/portal\/messages$/);
    await expect(page.getByTestId("nav-tab-messages")).toHaveAttribute("aria-current", "page");

    await page.getByTestId("nav-tab-account").click();
    await expect(page).toHaveURL(/\/portal\/account$/);
    await expect(page.getByTestId("portal-account")).toBeVisible();
    await expect(page.getByTestId("nav-tab-account")).toHaveAttribute("aria-current", "page");

    // Old tab URLs still work: they land on the right Trips segment.
    await page.goto("/portal/quotes");
    await expect(page).toHaveURL(/\/portal\/trips\/quotes$/);
    await expect(page.getByTestId("trips-segment-quotes")).toHaveAttribute("aria-current", "page");
    await page.goto("/portal/bookings");
    await expect(page).toHaveURL(/\/portal\/trips\/bookings$/);
    await expect(page.getByTestId("trips-segment-bookings")).toHaveAttribute("aria-current", "page");
  });

  test("the Account page lists its rows, and Sign out returns to the login screen", async ({ page }) => {
    const c = await seedPortalCustomer();
    await startSignedIn(page, c);

    await page.goto("/portal/account");
    for (const id of ["referrals", "interests", "change-pin", "face-id", "notifications", "install"]) {
      await expect(page.getByTestId(`account-row-${id}`)).toBeVisible();
    }
    await page.getByTestId("account-row-referrals").click();
    await expect(page).toHaveURL(/\/portal\/referrals$/);

    await page.goto("/portal/account");
    await page.getByTestId("button-logout").click();
    await expect(page).toHaveURL(/\/portal\/login/);
    expect(await page.evaluate(() => localStorage.getItem("portal_token"))).toBeNull();
  });

  test("Change PIN: the new PIN works for the next sign-in", async ({ page }) => {
    const c = await seedPortalCustomer();
    await startSignedIn(page, c);

    await page.goto("/portal/account");
    await page.getByTestId("account-row-change-pin").click();
    await page.getByTestId("input-account-new-pin").fill("9073");
    await page.getByTestId("input-account-confirm-pin").fill("9073");
    await page.getByTestId("button-account-save-pin").click();
    await expect(page.getByTestId("dialog-change-pin")).toHaveCount(0);

    const ok = await page.request.post("/api/v2/portal/login", { data: { email: c.email, pin: "9073", org: c.slug } });
    expect(ok.status()).toBe(200);
  });
});

test.describe("customer portal: sign-in links", () => {
  async function whoAmI(page: import("@playwright/test").Page): Promise<string> {
    return page.evaluate(async () => {
      const res = await fetch("/api/portal/user", { headers: { Authorization: `Bearer ${localStorage.getItem("portal_token")}` } });
      return ((await res.json()) as { email: string }).email;
    });
  }

  test("a link for customer B opened while customer A is signed in signs A out and signs B in (code removed from the URL)", async ({ page }) => {
    const a = await seedPortalCustomer();
    const b = await seedPortalCustomer();
    await startSignedIn(page, a);
    const code = await mintLoginCode(b.clientId);

    await page.goto(`/portal/login?mt=${code}&next=${encodeURIComponent("/portal/account?change-pin=1")}`);
    await expect(page).toHaveURL(/\/portal\/account/);
    // It is B who is signed in, and B (not A) is the one asked to choose a new PIN.
    await expect(page.getByTestId("dialog-change-pin")).toBeVisible();
    expect(await whoAmI(page)).toBe(b.email);
    expect(page.url()).not.toContain("mt=");
    // The code was single-use and is now spent.
    expect(await queryRows(`select 1 from portal_login_tokens where code = $1 and used = true`, [code])).toHaveLength(1);
  });

  test("a customer who has just chosen a PIN at the PIN gate is not asked again by the Account dialog", async ({ page }) => {
    const c = await seedPortalCustomer({ mustChangePin: true });
    const code = await mintLoginCode(c.clientId);
    await page.goto(`/portal/login?mt=${code}&next=${encodeURIComponent("/portal/account?change-pin=1")}`);

    await page.getByTestId("input-new-pin").fill("9073");
    await page.getByTestId("input-confirm-pin").fill("9073");
    await page.getByTestId("button-save-pin").click();

    await expect(page.getByTestId("portal-account")).toBeVisible();
    await expect(page.getByTestId("dialog-change-pin")).toHaveCount(0);
    expect(page.url()).not.toContain("change-pin");
  });

  test("a reset link keeps its new-PIN step through the forced interests page", async ({ page }) => {
    const c = await seedPortalCustomer({ withInterest: false });
    const code = await mintLoginCode(c.clientId);
    await page.goto(`/portal/login?mt=${code}&next=${encodeURIComponent("/portal/account?change-pin=1")}`);

    await expect(page).toHaveURL(/\/portal\/tags/);
    await page.getByRole("button", { name: c.tagName }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/portal\/account/);
    await expect(page.getByTestId("dialog-change-pin")).toBeVisible();
  });

  test("a legacy ?token= link is removed from the address bar", async ({ page }) => {
    const c = await seedPortalCustomer();
    const res = await page.request.post("/api/v2/portal/login", { data: { email: c.email, pin: c.pin, org: c.slug } });
    const { token } = (await res.json()) as { token: string };
    await page.addInitScript(() => localStorage.setItem("portal_setup_wizard_done", "1"));
    await page.goto(`/portal/login?token=${encodeURIComponent(token)}`);
    await expect(page).toHaveURL(/\/portal$/);
    expect(page.url()).not.toContain("token=");
  });
});

test.describe("customer portal: Face ID set-ups", () => {
  async function addCredential(clientId: string, credentialId: string): Promise<string> {
    const rows = await queryRows<{ id: string }>(
      `insert into webauthn_credentials (client_id, credential_id, public_key, verified_at) values ($1, $2, 'pk', now()) returning id`,
      [clientId, credentialId],
    );
    return rows[0].id;
  }

  test("the list shows only my set-ups, and removing affects only mine, with the same answer for anything else", async ({ page }) => {
    const me = await seedPortalCustomer();
    const other = await seedPortalCustomer();
    const mine = await addCredential(me.clientId, unique("cred-mine"));
    const theirs = await addCredential(other.clientId, unique("cred-theirs"));
    await startSignedIn(page, me);
    await page.goto("/portal");
    const auth = { Authorization: await bearer(page) };

    const list = await page.request.get("/api/v2/portal/webauthn/credentials", { headers: auth });
    expect(((await list.json()) as { id: string }[]).map((r) => r.id)).toEqual([mine]);

    const foreign = await page.request.fetch(`/api/v2/portal/webauthn/credentials/${theirs}`, { method: "DELETE", headers: auth });
    const missing = await page.request.fetch("/api/v2/portal/webauthn/credentials/99999999-2222-4333-8444-555555555555", { method: "DELETE", headers: auth });
    expect([foreign.status(), missing.status()]).toEqual([200, 200]);
    expect(await foreign.json()).toEqual(await missing.json());
    expect(await queryRows(`select 1 from webauthn_credentials where id = $1`, [theirs])).toHaveLength(1);

    const own = await page.request.fetch(`/api/v2/portal/webauthn/credentials/${mine}`, { method: "DELETE", headers: auth });
    expect(own.status()).toBe(200);
    expect(await queryRows(`select 1 from webauthn_credentials where id = $1`, [mine])).toHaveLength(0);

    const noSession = await page.request.fetch(`/api/v2/portal/webauthn/credentials/${theirs}`, { method: "DELETE" });
    expect(noSession.status()).toBe(401);
  });

  test("the Account page lists another device's set-up and removes it on the server", async ({ page }) => {
    const me = await seedPortalCustomer();
    const id = await addCredential(me.clientId, unique("cred-other"));
    await startSignedIn(page, me);
    await page.goto("/portal/account");
    await page.getByTestId(`button-face-id-remove-device-${id}`).click();
    await expect(page.getByTestId("face-id-note")).toContainText("can no longer sign in");
    expect(await queryRows(`select 1 from webauthn_credentials where id = $1`, [id])).toHaveLength(0);
  });
});

test.describe("customer portal: forgotten PIN", () => {
  // The practice server has no public site address (and no WhatsApp), so a reset can never reach the point of
  // minting a link here. Everything about minting, sending, the caps and who may ask is proved in
  // server/v2/modules/portal/portal-branding.integration.test.ts and the unit tests, NOT in this browser spec.
  test("shows the same confirmation for a real and a made-up email, and makes no outbound connection or SMS", async ({ page }) => {
    const c = await seedPortalCustomer();
    const before = readOutboundAttempts(OUTBOUND_LOG).length;

    await page.goto(`/portal/login?org=${c.slug}`);
    await page.getByTestId("button-forgot-pin").click();
    await page.getByTestId("input-reset-email").fill(c.email);
    await page.getByTestId("button-send-reset").click();
    const confirmation = page.getByTestId("text-pin-reset-confirmation");
    await expect(confirmation).toHaveText("If we have your details, we've sent you a sign-in link.");
    const realText = await confirmation.textContent();

    // A made-up email gets the identical words.
    await page.goto(`/portal/login?org=${c.slug}`);
    await page.getByTestId("button-forgot-pin").click();
    await page.getByTestId("input-reset-email").fill(`ghost-${unique("g")}@e2e.test`);
    await page.getByTestId("button-send-reset").click();
    await expect(page.getByTestId("text-pin-reset-confirmation")).toHaveText(realText ?? "");

    // The work runs in the background after the answer: give it time, then check nothing was written or sent.
    await page.waitForTimeout(1500);
    expect(await queryRows(`select 1 from sms_messages where client_id = $1`, [c.clientId])).toHaveLength(0);
    expect(readOutboundAttempts(OUTBOUND_LOG).length).toBe(before);
  });
});

test.describe("customer portal: agency branding", () => {
  test("the login screen shows the agency's logo and name from ?org=, and never a fixed brand", async ({ page }) => {
    const withLogo = await seedPortalCustomer({ logoUrl: "/favicon.png", brandColor: "#1a5fb4" });
    await page.goto(`/portal/login?org=${withLogo.slug}`);
    await expect(page.getByTestId("portal-agency-logo")).toBeVisible();
    await expect(page.getByTestId("portal-agency-logo")).toHaveAttribute("alt", withLogo.orgName);
    await expect(page.locator("body")).not.toContainText(/travana|tina/i);

    const noLogo = await seedPortalCustomer();
    await page.goto(`/portal/login?org=${noLogo.slug}`);
    await expect(page.getByTestId("portal-agency-name")).toHaveText(noLogo.orgName);
    await expect(page.getByTestId("portal-agency-logo")).toHaveCount(0);
  });

  test("a dark brand colour drives the theme; a too-light one stays navy and only accents", async ({ page }) => {
    const NAVY = "212.5 100.0% 18.8%";
    const dark = await seedPortalCustomer({ brandColor: "#1a5fb4" });
    await page.goto(`/portal/login?org=${dark.slug}`);
    await expect(page.getByTestId("portal-agency-name")).toBeVisible();
    await expect.poll(() => page.locator(".portal-theme").first().evaluate((el) => (el as HTMLElement).style.getPropertyValue("--primary"))).not.toBe(NAVY);

    const light = await seedPortalCustomer({ brandColor: "#f4c430" });
    await page.goto(`/portal/login?org=${light.slug}`);
    await expect(page.getByTestId("portal-agency-name")).toBeVisible();
    const vars = await page.locator(".portal-theme").first().evaluate((el) => ({
      primary: (el as HTMLElement).style.getPropertyValue("--primary"),
      accent: (el as HTMLElement).style.getPropertyValue("--portal-brand-accent"),
    }));
    expect(vars.primary).toBe(NAVY);
    expect(vars.accent).not.toBe("");
  });

  test("the public branding endpoint answers 200 with nothing for an unknown agency and leaks nothing extra", async ({ page }) => {
    const c = await seedPortalCustomer({ brandColor: "#1a5fb4", atol: "ATOL 4321" });

    const unknown = await page.request.get(`/api/v2/portal/branding/no-such-agency-${unique("x").toLowerCase()}`);
    expect(unknown.status()).toBe(200);
    expect(await unknown.json()).toMatchObject({ name: null, logoUrl: null, brandColor: null });

    const known = await page.request.get(`/api/v2/portal/branding/${c.slug}`);
    expect(known.status()).toBe(200);
    const body = (await known.json()) as Record<string, unknown>;
    expect(body.name).toBe(c.orgName);
    expect(body.atol).toBe("ATOL 4321");
    expect("agentName" in body).toBe(false);
    expect(Object.keys(body).sort()).toEqual(["address", "atol", "brandColor", "email", "iconUrl", "logoUrl", "name", "phone"]);
  });
});

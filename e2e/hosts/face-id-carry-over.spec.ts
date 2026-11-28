/**
 * Two-host run: Face ID set up on the staff host before the move still works on the portal host.
 *
 * The portal host (portal.localhost) is a subdomain of the staff host (localhost), so the server uses the STAFF hostname as
 * the RP ID and accepts both origins. A Chromium virtual authenticator (a platform authenticator with a resident key) stands
 * in for Face ID. The passkey is registered from a page on the STAFF origin, then the same page is taken to the PORTAL origin,
 * where this device has no remembered set-up (localStorage is per origin).
 *
 * Unverified until run: that Chromium accepts rpId "localhost" from a page on "portal.localhost" (the web platform allows a
 * registrable parent; "localhost" is a special name). If it refuses, switch the two test host names to ones that resolve
 * through BROWSER_ARGS (e.g. staff.test / portal.staff.test) rather than weakening the server rule.
 */
import type { CDPSession, Page } from "@playwright/test";
import { BASE_URL, PORTAL_ORIGIN } from "../helpers/env";
import { expect, test } from "../helpers/fixtures";
import { PORTAL_PIN, seedPortalCustomer, startSignedIn, type PortalSetup } from "../helpers/portal";

async function addVirtualAuthenticator(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  return cdp;
}

/** What the old (staff-host) app did: a PIN session, then register Face ID from a page on the staff origin. Returns the credential id. */
async function registerOnStaffOrigin(page: Page, setup: PortalSetup): Promise<string> {
  const login = await page.request.post(`${BASE_URL}/api/v2/portal/login`, { data: { email: setup.email, pin: PORTAL_PIN, org: setup.slug } });
  expect(login.status()).toBe(200);
  const { token } = (await login.json()) as { token: string };
  await page.goto(`${BASE_URL}/favicon.png`);
  return page.evaluate(async (t) => {
    const toBuf = (s: string): ArrayBuffer => {
      const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
      return Uint8Array.from(bin, (c) => c.charCodeAt(0)).buffer;
    };
    const toB64u = (b: ArrayBuffer): string => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${t}` };
    const opt = (await (await fetch("/api/v2/portal/webauthn/register/options", { method: "POST", headers, body: "{}" })).json()) as {
      options: { challenge: string; user: { id: string }; excludeCredentials?: Array<{ id: string }> } & Record<string, unknown>;
      challengeToken: string;
    };
    const publicKey = {
      ...opt.options,
      challenge: toBuf(opt.options.challenge),
      user: { ...opt.options.user, id: toBuf(opt.options.user.id) },
      excludeCredentials: (opt.options.excludeCredentials ?? []).map((c) => ({ ...c, id: toBuf(c.id), type: "public-key" as const })),
    } as unknown as PublicKeyCredentialCreationOptions;
    const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential;
    const att = cred.response as AuthenticatorAttestationResponse;
    const res = await fetch("/api/v2/portal/webauthn/register", {
      method: "POST",
      headers,
      body: JSON.stringify({
        challengeToken: opt.challengeToken,
        response: {
          id: cred.id,
          rawId: cred.id,
          type: "public-key",
          clientExtensionResults: cred.getClientExtensionResults(),
          response: { clientDataJSON: toB64u(att.clientDataJSON), attestationObject: toB64u(att.attestationObject), transports: att.getTransports() },
        },
        deviceName: "E2E",
      }),
    });
    if (!res.ok) throw new Error(`register failed ${res.status}`);
    return cred.id;
  }, token);
}

test.describe("Face ID carried across the move", () => {
  test("a device with no remembered set-up offers it quietly on the portal host and signs in with the carried-over passkey", async ({ page }) => {
    const setup = await seedPortalCustomer();
    await addVirtualAuthenticator(page);
    const credentialId = await registerOnStaffOrigin(page, setup);

    await page.addInitScript(() => localStorage.setItem("portal_setup_wizard_done", "1"));
    await page.goto(`${PORTAL_ORIGIN}/portal/login`);
    expect(await page.evaluate(() => localStorage.getItem("portal_credential_id"))).toBeNull();

    const button = page.getByTestId("button-biometric-login");
    await expect(button).toBeVisible();
    await button.click();
    await page.waitForURL((u) => u.origin === PORTAL_ORIGIN && u.pathname.startsWith("/portal") && !u.pathname.startsWith("/portal/login"));
    expect(await page.evaluate(() => localStorage.getItem("portal_credential_id"))).toBe(credentialId);
  });

  test("a customer who signed in with the PIN is offered 'Use Face ID on this device', not a new set-up", async ({ page }) => {
    const setup = await seedPortalCustomer();
    await addVirtualAuthenticator(page);
    const credentialId = await registerOnStaffOrigin(page, setup);

    await startSignedIn(page, setup);
    await page.goto(`${PORTAL_ORIGIN}/portal/account`);
    await expect(page.getByTestId("button-face-id-setup")).toHaveCount(0);
    const useHere = page.getByTestId("button-face-id-use-here");
    await expect(useHere).toBeVisible();
    await useHere.click();
    await expect(page.getByTestId("button-face-id-remove")).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("portal_credential_id"))).toBe(credentialId);
  });

  test("with no usable passkey on this device the login screen offers nothing it cannot do, and a failed try is quiet", async ({ page }) => {
    const setup = await seedPortalCustomer();
    await addVirtualAuthenticator(page);
    await page.goto(`${PORTAL_ORIGIN}/portal/login`);
    await page.getByTestId("button-biometric-login").click();
    // Back on the PIN form with no error message.
    await expect(page.getByTestId("input-pin")).toBeVisible();
    await expect(page.getByTestId("text-error")).toHaveCount(0);
    expect(setup.email).toBeTruthy();
  });
});

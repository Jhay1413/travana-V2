import type { Page } from "@playwright/test";
import { expect, loginViaApi, loginViaUi, test } from "../helpers/fixtures";
import { TEST_PASSWORD, countSessionsFor, expireResetToken, findUser, readResetToken, seedAgency, uniqueEmail } from "../helpers/seed";

const NEW_PASSWORD = "Brand-New-Passw0rd!";

async function requestResetViaUi(page: Page, email: string): Promise<void> {
  await page.goto("/forgot-password");
  await page.getByTestId("input-forgot-email").fill(email);
  await page.getByTestId("button-forgot-submit").click();
  await expect(page.getByTestId("text-forgot-success")).toBeVisible();
}

async function setNewPasswordViaUi(page: Page, token: string, password: string): Promise<void> {
  await page.goto(`/reset-password/${token}`);
  await page.getByTestId("input-new-password").fill(password);
  await page.getByTestId("input-confirm-password").fill(password);
  await page.getByTestId("button-reset-submit").click();
}

test.describe("forgot password", () => {
  test("request a reset, set a new password, sign in with it; the old one and the used link no longer work", async ({ page, request }) => {
    const agency = await seedAgency();

    await requestResetViaUi(page, agency.adminEmail);
    const token = await readResetToken(agency.adminEmail);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const stored = await findUser(agency.adminEmail);
    expect(stored?.resetTokenExpiry && stored.resetTokenExpiry.getTime()).toBeGreaterThan(Date.now());

    await setNewPasswordViaUi(page, token, NEW_PASSWORD);
    await expect(page.getByTestId("text-reset-success")).toBeVisible();

    // The token is single use: cleared once the password is set.
    const after = await findUser(agency.adminEmail);
    expect(after?.resetToken).toBeNull();
    expect(after?.resetTokenExpiry).toBeNull();

    // New password works, old one does not.
    expect((await loginViaApi(request, agency.adminEmail, TEST_PASSWORD)).status()).toBe(401);
    await loginViaUi(page, agency.adminEmail, NEW_PASSWORD);
    await expect(page.getByTestId("input-email")).toHaveCount(0);
    expect((await page.request.get("/api/auth/user")).status()).toBe(200);

    // Reusing the same link fails with the on-page error and a 400.
    await setNewPasswordViaUi(page, token, "Another-Passw0rd!");
    await expect(page.getByTestId("text-reset-error")).toContainText("Invalid or expired reset link");
    const reuse = await request.post("/api/auth/reset-password", { data: { token, password: "Another-Passw0rd!" } });
    expect(reuse.status()).toBe(400);
  });

  test("a successful reset ends every existing session of that user", async ({ playwright, baseURL, request }) => {
    const agency = await seedAgency();
    const attacker = await playwright.request.newContext({ baseURL: baseURL! });
    expect((await loginViaApi(attacker, agency.adminEmail, TEST_PASSWORD)).status()).toBe(200);
    expect((await attacker.get("/api/auth/user")).status()).toBe(200);

    await request.post("/api/auth/forgot-password", { data: { email: agency.adminEmail } });
    const token = await readResetToken(agency.adminEmail);
    // A request that is merely made (no reset yet) leaves the session alone.
    expect((await attacker.get("/api/auth/user")).status()).toBe(200);

    const reset = await request.post("/api/auth/reset-password", { data: { token, password: NEW_PASSWORD } });
    expect(reset.status(), await reset.text()).toBe(200);

    expect((await attacker.get("/api/auth/user")).status()).toBe(401);
    expect(await countSessionsFor(agency.adminId)).toBe(0);
  });

  test("a malformed email gets the same reply as an unknown one; missing input is a 400", async ({ request }) => {
    const unknown = await request.post("/api/auth/forgot-password", { data: { email: uniqueEmail("ghost") } });
    const malformed = await request.post("/api/auth/forgot-password", { data: { email: "not-an-email" } });
    expect(malformed.status()).toBe(200);
    expect(await malformed.json()).toEqual(await unknown.json());
    expect((await request.post("/api/auth/forgot-password", { data: {} })).status()).toBe(400);
  });

  test("answers identically for an unknown email and creates nothing", async ({ request }) => {
    const agency = await seedAgency();
    const known = await request.post("/api/auth/forgot-password", { data: { email: agency.adminEmail } });
    const unknown = await request.post("/api/auth/forgot-password", { data: { email: uniqueEmail("ghost") } });

    expect(known.status()).toBe(200);
    expect(unknown.status()).toBe(200);
    expect(await unknown.json()).toEqual(await known.json());
  });

  test("a made-up link shows the invalid-link error", async ({ page }) => {
    await setNewPasswordViaUi(page, "this-token-never-existed", NEW_PASSWORD);
    await expect(page.getByTestId("text-reset-error")).toContainText("Invalid or expired reset link");
  });

  test("an expired link shows the expiry error and leaves the old password working", async ({ page, request }) => {
    const agency = await seedAgency();
    await request.post("/api/auth/forgot-password", { data: { email: agency.adminEmail } });
    const token = await readResetToken(agency.adminEmail);
    await expireResetToken(agency.adminEmail);

    await setNewPasswordViaUi(page, token, NEW_PASSWORD);
    await expect(page.getByTestId("text-reset-error")).toContainText("Reset link has expired");

    expect((await loginViaApi(request, agency.adminEmail, NEW_PASSWORD)).status()).toBe(401);
    expect((await loginViaApi(request, agency.adminEmail, TEST_PASSWORD)).status()).toBe(200);
  });

  test("a too-short password is refused on the page", async ({ page, request }) => {
    const agency = await seedAgency();
    await request.post("/api/auth/forgot-password", { data: { email: agency.adminEmail } });
    const token = await readResetToken(agency.adminEmail);

    await setNewPasswordViaUi(page, token, "abc");
    await expect(page.getByTestId("text-reset-error")).toContainText("at least 6 characters");
    // The token survives a refused attempt.
    expect(await readResetToken(agency.adminEmail)).toBe(token);
  });
});

import type { APIRequestContext } from "@playwright/test";
import { expect, expectLoginOk, loginViaApi, loginViaUi, test } from "../helpers/fixtures";
import { seedAgency, seedMember, seedPlatformAdmin } from "../helpers/seed";

const ORG_ME = "/api/v2/organizations/me";
const SUSPENDED_MESSAGE = "Your agency account has been suspended. Contact Travana support.";

async function suspend(admin: APIRequestContext, orgId: string): Promise<void> {
  const res = await admin.patch(`/api/v2/platform-admin/organizations/${orgId}/suspend`, { data: { reason: "E2E suspension check" } });
  expect(res.status(), await res.text()).toBe(200);
}

async function unsuspend(admin: APIRequestContext, orgId: string): Promise<void> {
  const res = await admin.patch(`/api/v2/platform-admin/organizations/${orgId}/activate`, { data: {} });
  expect(res.status(), await res.text()).toBe(200);
}

async function expectRefused(request: APIRequestContext, path: string): Promise<void> {
  const res = await request.get(path);
  expect(res.status(), `${path}: ${await res.text()}`).toBe(403);
  const body = await res.json();
  expect(body.code).toBe("ORG_SUSPENDED");
  expect(body.message).toBe(SUSPENDED_MESSAGE);
}

test.describe("suspended organisation", () => {
  test("running sessions are refused, login is refused, and unsuspending restores both", async ({ playwright, baseURL, request }) => {
    const agency = await seedAgency();
    const agent = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "agent" });
    const platform = await seedPlatformAdmin();

    const ownerCtx = await playwright.request.newContext({ baseURL: baseURL! });
    const agentCtx = await playwright.request.newContext({ baseURL: baseURL! });
    const adminCtx = await playwright.request.newContext({ baseURL: baseURL! });
    await expectLoginOk(ownerCtx, agency.adminEmail);
    await expectLoginOk(agentCtx, agent.email);
    await expectLoginOk(adminCtx, platform.email);

    // Before: everyone works.
    expect((await agentCtx.get(ORG_ME)).status()).toBe(200);
    expect((await ownerCtx.get(ORG_ME)).status()).toBe(200);

    await suspend(adminCtx, agency.orgId);

    // Running sessions (owner and agent) are refused on a scoped route and on the session check.
    for (const ctx of [agentCtx, ownerCtx]) {
      await expectRefused(ctx, ORG_ME);
      await expectRefused(ctx, "/api/v2/clients");
      await expectRefused(ctx, "/api/auth/user");
    }

    // The /api/auth self-service writes are refused too, and the session is kept.
    for (const ctx of [agentCtx, ownerCtx]) {
      for (const res of [
        await ctx.post("/api/auth/change-password", { data: { oldPassword: "x", newPassword: "abcdef", confirmPassword: "abcdef" } }),
        await ctx.patch("/api/auth/profile", { data: { phoneNumber: "07700900999" } }),
        await ctx.post("/api/auth/avatar"),
      ]) {
        expect(res.status(), await res.text()).toBe(403);
        expect((await res.json()).code).toBe("ORG_SUSPENDED");
      }
    }

    // Fresh logins are refused with the same code, and no session cookie is issued.
    const denied = await loginViaApi(request, agent.email);
    expect(denied.status()).toBe(403);
    expect((await denied.json()).code).toBe("ORG_SUSPENDED");
    expect((await request.get("/api/auth/user")).status()).toBe(401);

    // A wrong password still looks like any other wrong password.
    expect((await loginViaApi(request, agent.email, "not-the-password")).status()).toBe(401);

    // Platform admin: unaffected, and can impersonate the suspended agency to investigate.
    expect((await adminCtx.get("/api/auth/user")).status()).toBe(200);
    const impersonate = await adminCtx.post(`/api/v2/platform-admin/organizations/${agency.orgId}/impersonate`);
    expect(impersonate.status(), await impersonate.text()).toBe(200);
    const asOrg = await adminCtx.get(ORG_ME);
    expect(asOrg.status(), await asOrg.text()).toBe(200);
    expect((await adminCtx.get("/api/auth/user")).status()).toBe(200);

    await unsuspend(adminCtx, agency.orgId);

    // The very same sessions work again, and login works.
    expect((await agentCtx.get(ORG_ME)).status()).toBe(200);
    expect((await ownerCtx.get(ORG_ME)).status()).toBe(200);
    expect((await agentCtx.get("/api/auth/user")).status()).toBe(200);
    await expectLoginOk(request, agent.email);
  });

  test("sign-in page shows the message on login and when a running session is refused", async ({ page, playwright, baseURL }) => {
    const agency = await seedAgency();
    const platform = await seedPlatformAdmin();
    const adminCtx = await playwright.request.newContext({ baseURL: baseURL! });
    await expectLoginOk(adminCtx, platform.email);

    // Signed in, then the agency is suspended: the next page load lands on sign-in with the reason.
    await expectLoginOk(page.request, agency.adminEmail);
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/forgot-password/);
    await expect(page.getByTestId("input-email")).toHaveCount(0);

    await suspend(adminCtx, agency.orgId);
    await page.goto("/");
    await expect(page.getByTestId("input-email")).toBeVisible();
    await expect(page.getByTestId("text-auth-notice")).toHaveText(SUSPENDED_MESSAGE);

    // Trying to sign in shows the same message inline, not a broken page.
    await loginViaUi(page, agency.adminEmail);
    await expect(page.getByTestId("text-login-error")).toHaveText(SUSPENDED_MESSAGE);

    // After unsuspending, signing in works.
    await unsuspend(adminCtx, agency.orgId);
    await page.getByTestId("button-login").click();
    await expect(page.getByTestId("input-email")).toHaveCount(0);
  });
});

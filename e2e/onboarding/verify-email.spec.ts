import { expect, expectToast, loginViaApi, loginViaUi, newSignup, signupViaApi, test } from "../helpers/fixtures";
import {
  TEST_PASSWORD,
  backdateVerificationSend,
  expireVerificationToken,
  readVerificationToken,
  requireUser,
} from "../helpers/seed";

async function signUp(request: Parameters<typeof signupViaApi>[0]) {
  const input = newSignup();
  const res = await signupViaApi(request, input);
  expect(res.status(), await res.text()).toBe(201);
  return input;
}

test.describe("verify email", () => {
  test("a valid link verifies the owner, who can then sign in and lands in the setup wizard", async ({ page, request }) => {
    const input = await signUp(request);
    const token = await readVerificationToken(input.email);

    await page.goto(`/verify-email?token=${token}`);
    await expect(page.getByTestId("text-verify-confirm-title")).toHaveText("Email verified");

    const verified = await requireUser(input.email);
    expect(verified.emailVerified).toBe(true);
    expect(verified.verificationToken).toBeNull();
    expect(verified.verificationTokenExpiry).toBeNull();

    await page.getByTestId("button-continue-to-signin").click();
    await loginViaUi(page, input.email, input.password);

    // Onboarding is still pending, so the owner goes straight to the wizard.
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { name: "Welcome to Travana" })).toBeVisible();
  });

  test("a link that was already used shows the failed state and API code VERIFICATION_LINK_INVALID", async ({ page, request }) => {
    const input = await signUp(request);
    const token = await readVerificationToken(input.email);

    const first = await request.get(`/api/v2/onboarding/verify-email?token=${token}`);
    expect(first.status()).toBe(200);

    await page.goto(`/verify-email?token=${token}`);
    await expect(page.getByTestId("text-verify-confirm-title")).toHaveText("Verification failed");
    await expect(page.getByTestId("text-verify-error")).toContainText("already been used or has expired");

    const second = await request.get(`/api/v2/onboarding/verify-email?token=${token}`);
    expect(second.status()).toBe(400);
    expect((await second.json()).code).toBe("VERIFICATION_LINK_INVALID");
  });

  test("a made-up link shows the failed state and offers to sign in or request a new link", async ({ page, request }) => {
    await page.goto("/verify-email?token=this-token-never-existed");
    await expect(page.getByTestId("text-verify-confirm-title")).toHaveText("Verification failed");
    await expect(page.getByTestId("button-back-to-login")).toBeVisible();
    await expect(page.getByTestId("button-request-new-link")).toBeVisible();

    const res = await request.get("/api/v2/onboarding/verify-email?token=this-token-never-existed");
    expect(res.status()).toBe(400);
    expect((await res.json()).code).toBe("VERIFICATION_LINK_INVALID");
  });

  test("an expired link shows the same failed state and leaves the account unverified", async ({ page, request }) => {
    const input = await signUp(request);
    const token = await readVerificationToken(input.email);
    await expireVerificationToken(input.email);

    await page.goto(`/verify-email?token=${token}`);
    await expect(page.getByTestId("text-verify-confirm-title")).toHaveText("Verification failed");

    const res = await request.get(`/api/v2/onboarding/verify-email?token=${token}`);
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Verification link has expired");
    expect((await requireUser(input.email)).emailVerified).toBe(false);
  });

  test("a request with no token is rejected", async ({ request }) => {
    const res = await request.get("/api/v2/onboarding/verify-email");
    expect(res.status()).toBe(400);
  });

  test("resend is refused during the 60 second cooldown after signup and explains why", async ({ page, request }) => {
    const input = await signUp(request);
    const before = await readVerificationToken(input.email);

    await page.goto(`/verify-email?email=${encodeURIComponent(input.email)}`);
    await page.getByTestId("button-resend-verification").click();
    await expectToast(page, "Couldn't resend");

    const api = await request.post("/api/v2/onboarding/resend-verification", { data: { email: input.email } });
    expect(api.status()).toBe(429);
    expect((await api.json()).message).toMatch(/Please wait \d+ seconds/);
    expect(await readVerificationToken(input.email)).toBe(before);
  });

  test("once the cooldown is over, resend issues a new token and the button counts down", async ({ page, request }) => {
    const input = await signUp(request);
    const before = await readVerificationToken(input.email);
    await backdateVerificationSend(input.email);

    await page.goto(`/verify-email?email=${encodeURIComponent(input.email)}`);
    await page.getByTestId("button-resend-verification").click();
    await expectToast(page, "Verification email sent");
    await expect(page.getByTestId("button-resend-verification")).toContainText(/Resend again in \d+s/);
    await expect(page.getByTestId("button-resend-verification")).toBeDisabled();

    const after = await readVerificationToken(input.email);
    expect(after).not.toBe(before);

    // The old link is dead, the new one works.
    const old = await request.get(`/api/v2/onboarding/verify-email?token=${before}`);
    expect(old.status()).toBe(400);
    const fresh = await request.get(`/api/v2/onboarding/verify-email?token=${after}`);
    expect(fresh.status()).toBe(200);
  });

  test("resend for an unknown address looks the same as success (no account enumeration)", async ({ request }) => {
    const res = await request.post("/api/v2/onboarding/resend-verification", { data: { email: `nobody-${Date.now()}@e2e.test` } });
    expect(res.status()).toBe(200);
  });

  test("signing in before verifying is blocked with EMAIL_NOT_VERIFIED", async ({ request }) => {
    const input = await signUp(request);
    const res = await loginViaApi(request, input.email, input.password);
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("EMAIL_NOT_VERIFIED");
    expect(body.email).toBe(input.email);

    // No session was created.
    const me = await request.get("/api/auth/user");
    expect(me.status()).toBe(401);
  });

  test("the sign-in form sends an unverified owner to the check-your-email screen", async ({ page, request }) => {
    const input = await signUp(request);
    await loginViaUi(page, input.email, input.password);
    await expect(page).toHaveURL(new RegExp(`/verify-email\\?email=`));
    await expect(page.getByTestId("text-verify-pending-title")).toBeVisible();
  });

  test("a wrong password is reported as invalid credentials, not as unverified", async ({ request }) => {
    const input = await signUp(request);
    const res = await loginViaApi(request, input.email, `${TEST_PASSWORD}-wrong`);
    expect(res.status()).toBe(401);
  });
});

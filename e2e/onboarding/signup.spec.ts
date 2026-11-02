import { expect, expectToast, fillSignupForm, newSignup, signupViaApi, submitSignupForm, test } from "../helpers/fixtures";
import { findOrgByOwnerEmail, requireUser } from "../helpers/seed";

test.describe("signup", () => {
  test("creates the agency and sends the owner to the verify-your-email screen", async ({ page }) => {
    const input = newSignup();
    await page.goto("/signup");
    await expect(page.getByTestId("text-signup-title")).toHaveText("Start your agency");

    await fillSignupForm(page, input);
    await submitSignupForm(page);

    await expect(page).toHaveURL(new RegExp(`/verify-email\\?email=${encodeURIComponent(input.email).replace(/\./g, "\\.")}`));
    await expect(page.getByTestId("text-verify-pending-title")).toBeVisible();
    await expect(page.getByText(input.email)).toBeVisible();

    // The dev email provider only logs, so the app reports the email as not sent (red toast).
    await expectToast(page, "We couldn't send the verification email.");

    const owner = await requireUser(input.email);
    expect(owner.emailVerified).toBe(false);
    expect(owner.orgRole).toBe("org_admin");
    expect(owner.verificationToken).toBeTruthy();
    const org = await findOrgByOwnerEmail(input.email);
    expect(org?.name).toBe(input.businessName);
    expect(org?.plan).toBe("starter");
    expect(org?.settings).toMatchObject({ onboarding: { status: "pending" } });
  });

  test("lowercases the email address it stores", async ({ page }) => {
    const input = newSignup();
    await page.goto("/signup");
    await fillSignupForm(page, { ...input, email: input.email.toUpperCase() });
    await submitSignupForm(page);
    await expect(page.getByTestId("text-verify-pending-title")).toBeVisible();
    expect((await requireUser(input.email)).email).toBe(input.email.toLowerCase());
  });

  test("refuses an email that already has an account (409) and stays on the form", async ({ page, request }) => {
    const input = newSignup();
    expect((await signupViaApi(request, input)).status()).toBe(201);

    await page.goto("/signup");
    await fillSignupForm(page, newSignup({ email: input.email }));
    await submitSignupForm(page);

    await expectToast(page, "Signup failed");
    await expectToast(page, "An account with this email already exists");
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("answers 409 for a duplicate email at the API, whatever the letter case", async ({ request }) => {
    const input = newSignup();
    expect((await signupViaApi(request, input)).status()).toBe(201);
    const again = await signupViaApi(request, { ...input, email: input.email.toUpperCase() });
    expect(again.status()).toBe(409);
  });

  test("gives a second agency with the same business name its own organisation and a different slug", async ({ request }) => {
    const name = `Twin Travel ${Date.now().toString(36)}`;
    const a = newSignup({ businessName: name });
    const b = newSignup({ businessName: name });
    expect((await signupViaApi(request, a)).status()).toBe(201);
    expect((await signupViaApi(request, b)).status()).toBe(201);

    const orgA = await findOrgByOwnerEmail(a.email);
    const orgB = await findOrgByOwnerEmail(b.email);
    expect(orgA?.id).toBeTruthy();
    expect(orgB?.id).toBeTruthy();
    expect(orgB?.id).not.toBe(orgA?.id);
    expect(orgB?.slug).not.toBe(orgA?.slug);
    expect(orgA?.name).toBe(name);
    expect(orgB?.name).toBe(name);
  });

  test("rejects a password shorter than 8 characters in the form and at the API", async ({ page, request }) => {
    await page.goto("/signup");
    await fillSignupForm(page, newSignup({ password: "short7!" }));
    await submitSignupForm(page);
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);

    const res = await signupViaApi(request, newSignup({ password: "short7!" }));
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Password must be at least 8 characters");
  });

  test("shows an error under every empty required field and creates nothing", async ({ page }) => {
    await page.goto("/signup");
    await submitSignupForm(page);

    await expect(page.getByText("Enter your business name.")).toBeVisible();
    await expect(page.getByText("Enter your first name.")).toBeVisible();
    await expect(page.getByText("Enter your last name.")).toBeVisible();
    await expect(page.getByText("Enter your email address.")).toBeVisible();
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("requires a business name of at least 2 characters", async ({ page, request }) => {
    await page.goto("/signup");
    await fillSignupForm(page, newSignup({ businessName: "A" }));
    await submitSignupForm(page);
    await expect(page.getByText("Enter your business name.")).toBeVisible();

    const res = await signupViaApi(request, newSignup({ businessName: "A" }));
    expect(res.status()).toBe(400);
  });

  test("rejects a malformed email in the form and at the API", async ({ page, request }) => {
    await page.goto("/signup");
    await fillSignupForm(page, newSignup({ email: "not-an-email" }));
    await submitSignupForm(page);
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);

    const res = await signupViaApi(request, newSignup({ email: "not-an-email" }));
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe("Email must be valid");
  });

  test("blocks the sixth sign-up attempt from one address with 429 and says so on screen", async ({ page, request }) => {
    // The limiter counts every request that reaches it, valid or not: five bad bodies use the allowance.
    for (let i = 0; i < 5; i++) {
      const res = await request.post("/api/v2/onboarding/signup", { data: {} });
      expect(res.status()).toBe(400);
    }

    await page.goto("/signup");
    await fillSignupForm(page, newSignup());
    await submitSignupForm(page);

    await expectToast(page, "Signup failed");
    await expectToast(page, "Too many sign-up attempts");
    await expect(page).toHaveURL(/\/signup$/);

    const blocked = await signupViaApi(request, newSignup());
    expect(blocked.status()).toBe(429);
    expect(blocked.headers()["retry-after"]).toBeTruthy();
  });
});

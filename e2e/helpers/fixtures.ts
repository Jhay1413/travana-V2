import { test as base, expect, type APIRequestContext, type APIResponse, type Page } from "@playwright/test";
import { installBrowserGuard, unexpectedRequests, type AbortedRequest } from "./browser-guard";
import { TEST_PASSWORD, randomIp } from "./seed";

/**
 * `test` with
 *  - a different X-Forwarded-For per test (trust proxy is 1, so req.ip is that address). The signup
 *    rate limit is per IP and in memory: this gives every test its own bucket.
 *  - the browser outbound guard (browser-guard.ts): requests to anything but the test server are aborted
 *    (api.postcodes.io gets a fake answer) and the test FAILS if an unexpected one was attempted.
 *    Tests that expect their own aborted requests can read the list from the "abortedRequests" fixture.
 *  - the Vite HMR socket cut off. In development the client reports every uncaught runtime error to
 *    the dev server over that socket, and server/vite.ts answers a logged error with process.exit(1).
 *    One page error would take the whole server down and fail every later test. The page itself is
 *    left untouched, so a crashing page still fails the test that caused it.
 */
export const test = base.extend<{ cutHmr: void; abortedRequests: AbortedRequest[] }>({
  abortedRequests: [
    async ({ context }, use) => {
      const aborted = await installBrowserGuard(context);
      await use(aborted);
      const bad = unexpectedRequests(aborted);
      const listing = bad.map((b) => `  ${b.resourceType} ${b.url}`).join("\n");
      expect(bad, `the page tried to reach outside the test server:\n${listing}`).toEqual([]);
    },
    { auto: true },
  ],
  extraHTTPHeaders: async ({}, use) => {
    await use({ "X-Forwarded-For": randomIp() });
  },
  cutHmr: [
    async ({ context }, use) => {
      await context.routeWebSocket(/\/vite-hmr/, () => {
        // Not connected to the server on purpose.
      });
      await use();
    },
    { auto: true },
  ],
});

export { expect };

/** A toast with this text. Radix also mirrors each toast into an aria-live region, so the text can match twice. */
export async function expectToast(page: Page, text: string | RegExp): Promise<void> {
  await expect(page.getByText(text).first()).toBeVisible();
}

/** The sign-in page's form. */
export async function loginViaUi(page: Page, email: string, password: string = TEST_PASSWORD): Promise<void> {
  await page.goto("/");
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill(password);
  await page.getByTestId("button-login").click();
}

/** Signs a request context in (sets the session cookie on it). `page.request` shares cookies with the page. */
export async function loginViaApi(
  request: APIRequestContext,
  email: string,
  password: string = TEST_PASSWORD,
): Promise<APIResponse> {
  return request.post("/api/auth/login", { data: { email, password } });
}

export async function expectLoginOk(request: APIRequestContext, email: string, password: string = TEST_PASSWORD): Promise<void> {
  const res = await loginViaApi(request, email, password);
  expect(res.status(), `login as ${email}: ${await res.text()}`).toBe(200);
}

export interface SignupInput {
  businessName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export async function signupViaApi(request: APIRequestContext, input: SignupInput): Promise<APIResponse> {
  return request.post("/api/v2/onboarding/signup", { data: input });
}

/** Fills and submits the /signup form. */
export async function fillSignupForm(page: Page, input: Partial<SignupInput>): Promise<void> {
  if (input.businessName !== undefined) await page.getByLabel("Business name").fill(input.businessName);
  if (input.firstName !== undefined) await page.getByLabel("First name").fill(input.firstName);
  if (input.lastName !== undefined) await page.getByLabel("Last name").fill(input.lastName);
  if (input.email !== undefined) await page.locator("#signup-email").fill(input.email);
  if (input.password !== undefined) await page.locator("#signup-password").fill(input.password);
}

export async function submitSignupForm(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Create account/ }).click();
}

/** The standard valid signup payload, with unique values. */
export function newSignup(overrides: Partial<SignupInput> = {}): SignupInput {
  const tag = Math.random().toString(36).slice(2, 8);
  return {
    businessName: `Sunrise Travel ${tag}`,
    firstName: "Sam",
    lastName: "Sunrise",
    email: `owner-${tag}-${Date.now().toString(36)}@e2e.test`,
    password: TEST_PASSWORD,
    ...overrides,
  };
}

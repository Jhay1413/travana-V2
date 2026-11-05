/**
 * Social Posts platform picker.
 *
 * OnlySocials can never be reached from the suite (no ONLYSOCIAL_API_KEY, outbound blocked), so the
 * three server calls that would touch it are answered at the browser layer with page.route():
 *   GET  /api/v2/social-settings/accounts   - the agency's connected accounts
 *   GET  /api/v2/social-settings/channel    - "is OnlySocials configured" (legacy posts show a Facebook dot only when it is)
 *   POST /api/v2/social-posts/:id/schedule  - the schedule call, so the multipart body can be read
 * Everything else (the grid, the editor, saving the text, the database) is the real app.
 */
import type { Page, Route } from "@playwright/test";
import { signIn } from "../helpers/deals";
import { expect, expectToast, test } from "../helpers/fixtures";
import { daysFromToday } from "../helpers/pipeline";
import { dbDeal, seedDealsAgency, seedSocialPost, type DealsAgency } from "../helpers/seed";

const FB_PAGE = 81085;
const IG = 7;
const IG_LOCKED = 8;
const FB_DEAD = 9;

const ACCOUNTS = [
  { id: FB_PAGE, name: "E2E Travel Page", username: "e2etravel", image: null, platform: "facebook", authorized: true, selectable: true },
  { id: IG, name: "E2E Travel IG", username: "e2etravel", image: null, platform: "instagram", authorized: true, selectable: true },
  { id: IG_LOCKED, name: "E2E Locked IG", username: null, image: null, platform: "instagram", authorized: true, selectable: false, unavailableReason: "Instagram coming soon" },
  { id: FB_DEAD, name: "E2E Dead Page", username: null, image: null, platform: "facebook", authorized: false, selectable: false, unavailableReason: "Reconnect in OnlySocials" },
];

const json = (route: Route, data: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });

/** Fakes the OnlySocials-backed GETs the Social Posts screens make. */
async function fakeOnlySocials(page: Page, accounts: unknown[] = ACCOUNTS): Promise<void> {
  await page.route("**/api/v2/social-settings/accounts**", (route) =>
    json(route, { success: true, data: { configured: true, accounts } }),
  );
  await page.route("**/api/v2/social-settings/channel", (route) =>
    json(route, {
      success: true,
      data: { provider: "onlysocials", accountId: FB_PAGE, workspaceConfigured: true, apiKeyConfigured: true, label: "Facebook Page via OnlySocials" },
    }),
  );
  // A scheduled post's media comes from OnlySocials; the fake has none.
  await page.route("**/api/v2/social-posts/*/media", (route) => json(route, { success: true, data: { media: [], postContent: "" } }));
}

interface Captured {
  body: string | null;
}

/** Answers the schedule POST with a success (or `failWith`) and records the multipart body. */
async function fakeSchedule(page: Page, dealId: string, quoteId: string, failWith?: { status: number; message: string }): Promise<Captured> {
  const captured: Captured = { body: null };
  await page.route("**/api/v2/social-posts/*/schedule", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    captured.body = route.request().postDataBuffer()?.toString("latin1") ?? "";
    if (failWith) return json(route, { success: false, message: failWith.message }, failWith.status);
    return json(route, {
      success: true,
      message: "Post scheduled successfully",
      data: { id: dealId, quote_id: quoteId, onlySocialsId: "os-fake", failedImageUrls: [], autoUpscale: { upscaled: [], skipped: [] } },
    });
  });
  return captured;
}

async function world(page: Page): Promise<DealsAgency> {
  const agency = await seedDealsAgency();
  await signIn(page, agency.adminEmail);
  return agency;
}

async function openEditor(page: Page, quoteId: string): Promise<void> {
  await page.goto("/social-posts");
  await page.getByTestId(`button-edit-post-${quoteId}`).click();
  await expect(page.getByTestId("dialog-social-post-preview")).toBeVisible();
  await expect(page.getByTestId("platform-picker")).toBeVisible();
}

async function openEditorNoPicker(page: Page, quoteId: string): Promise<void> {
  await page.goto("/social-posts");
  await page.getByTestId(`button-edit-post-${quoteId}`).click();
  await expect(page.getByTestId("dialog-social-post-preview")).toBeVisible();
}

const account = (page: Page, id: number) => page.getByTestId(`platform-account-${id}`);

async function fillSchedule(page: Page): Promise<void> {
  await page.getByTestId("input-schedule-date").fill(daysFromToday(30));
  await page.getByTestId("input-schedule-time").fill("09:00");
}

test.describe("platform picker in the editor", () => {
  test("a new post starts with every selectable account ticked; locked and disconnected ones say why and cannot be ticked", async ({ page }) => {
    const agency = await world(page);
    const post = await seedSocialPost({ userId: agency.adminId, orgId: agency.orgId, branchId: agency.branchId, title: "Picker defaults", withImage: true });
    await fakeOnlySocials(page);
    await openEditor(page, post.quoteId);

    await expect(account(page, FB_PAGE)).toHaveAttribute("aria-checked", "true");
    await expect(account(page, IG)).toHaveAttribute("aria-checked", "true");
    for (const id of [IG_LOCKED, FB_DEAD]) {
      await expect(account(page, id)).toBeDisabled();
      await expect(account(page, id)).toHaveAttribute("aria-checked", "false");
    }
    await expect(page.getByTestId(`platform-reason-${IG_LOCKED}`)).toHaveText("Instagram coming soon");
    await expect(page.getByTestId(`platform-reason-${FB_DEAD}`)).toHaveText("Reconnect in OnlySocials");
    await expect(page.getByText("Posts to Facebook and Instagram.")).toBeVisible();
  });

  test("the preview has a tab per ticked platform and Facebook-only options go with Facebook", async ({ page }) => {
    const agency = await world(page);
    const post = await seedSocialPost({ userId: agency.adminId, orgId: agency.orgId, branchId: agency.branchId, title: "Preview tabs", withImage: true });
    await fakeOnlySocials(page);
    await openEditor(page, post.quoteId);

    await expect(page.getByTestId("tab-preview-facebook")).toBeVisible();
    await expect(page.getByTestId("tab-preview-instagram")).toBeVisible();
    await expect(page.getByTestId("preview-facebook")).toBeVisible();
    await expect(page.getByTestId("switch-fb-view-link")).toBeVisible();

    await page.getByTestId("tab-preview-instagram").click();
    await expect(page.getByTestId("preview-instagram")).toBeVisible();
    await expect(page.getByTestId("instagram-links-note")).toHaveText("Links aren't clickable on Instagram");
    await expect(page.getByTestId("img-instagram-preview")).toBeVisible();

    // Instagram only: one preview, no tabs, no Facebook options.
    await account(page, FB_PAGE).click();
    await expect(page.getByTestId("tab-preview-facebook")).toHaveCount(0);
    await expect(page.getByTestId("preview-instagram")).toBeVisible();
    await expect(page.getByTestId("switch-fb-view-link")).toHaveCount(0);
    await expect(page.getByText("Posts to Instagram.")).toBeVisible();

    // Facebook only: back to the Facebook preview.
    await account(page, FB_PAGE).click();
    await account(page, IG).click();
    await expect(page.getByTestId("preview-facebook")).toBeVisible();
    await expect(page.getByTestId("preview-instagram")).toHaveCount(0);
    await expect(page.getByTestId("switch-fb-view-link")).toBeVisible();
  });

  test("Instagram without an image is blocked with the reason on screen; unticking it frees Schedule", async ({ page }) => {
    const agency = await world(page);
    const post = await seedSocialPost({ userId: agency.adminId, orgId: agency.orgId, branchId: agency.branchId, title: "No image", withImage: false });
    await fakeOnlySocials(page);
    await openEditor(page, post.quoteId);
    await fillSchedule(page);

    await expect(page.getByTestId("platform-block-reason")).toContainText("Instagram needs at least one image");
    await expect(page.getByTestId("button-save-and-schedule")).toBeDisabled();

    await account(page, IG).click();
    await expect(page.getByTestId("platform-block-reason")).toHaveCount(0);
    await expect(page.getByTestId("button-save-and-schedule")).toBeEnabled();
  });

  test("unticking everything blocks Schedule", async ({ page }) => {
    const agency = await world(page);
    const post = await seedSocialPost({ userId: agency.adminId, orgId: agency.orgId, branchId: agency.branchId, title: "Nothing ticked", withImage: true });
    await fakeOnlySocials(page);
    await openEditor(page, post.quoteId);
    await fillSchedule(page);

    await account(page, FB_PAGE).click();
    await account(page, IG).click();
    await expect(page.getByTestId("platform-block-reason")).toContainText("at least one account");
    await expect(page.getByTestId("button-save-and-schedule")).toBeDisabled();
  });

  test("scheduling sends the ticked accounts as accountIds in the multipart body", async ({ page }) => {
    const agency = await world(page);
    const post = await seedSocialPost({ userId: agency.adminId, orgId: agency.orgId, branchId: agency.branchId, title: "Both platforms", withImage: true });
    await fakeOnlySocials(page);
    const captured = await fakeSchedule(page, post.dealId, post.quoteId);
    await openEditor(page, post.quoteId);
    await fillSchedule(page);

    await page.getByTestId("button-save-and-schedule").click();
    await expectToast(page, /scheduled on OnlySocials/);

    expect(captured.body).toMatch(/name="accountIds"\r\n\r\n\[81085,7\]/);
  });

  test("a Facebook-only selection sends just that account", async ({ page }) => {
    const agency = await world(page);
    const post = await seedSocialPost({ userId: agency.adminId, orgId: agency.orgId, branchId: agency.branchId, title: "Facebook only", withImage: true });
    await fakeOnlySocials(page);
    const captured = await fakeSchedule(page, post.dealId, post.quoteId);
    await openEditor(page, post.quoteId);
    await fillSchedule(page);

    await account(page, IG).click();
    await page.getByTestId("button-save-and-schedule").click();
    await expectToast(page, /scheduled on OnlySocials/);

    expect(captured.body).toMatch(/name="accountIds"\r\n\r\n\[81085\]/);
  });

  test("an account disconnected after the editor loaded comes back as a 422 toast with its name", async ({ page }) => {
    const agency = await world(page);
    const post = await seedSocialPost({ userId: agency.adminId, orgId: agency.orgId, branchId: agency.branchId, title: "Gone by schedule time", withImage: true });
    await fakeOnlySocials(page);
    const message = "E2E Travel IG is disconnected or not available — reconnect it in OnlySocials or untick it";
    await fakeSchedule(page, post.dealId, post.quoteId, { status: 422, message });
    await openEditor(page, post.quoteId);
    await fillSchedule(page);

    await page.getByTestId("button-save-and-schedule").click();

    await expectToast(page, "OnlySocials error");
    await expectToast(page, message);
    // Still open, so the user can untick the account and try again.
    await expect(page.getByTestId("dialog-social-post-preview")).toBeVisible();
  });

  test("saving the text as a draft sends the ticked accounts so the draft remembers them", async ({ page }) => {
    const agency = await world(page);
    const post = await seedSocialPost({ userId: agency.adminId, orgId: agency.orgId, branchId: agency.branchId, title: "Remember me", withImage: true });
    await fakeOnlySocials(page);
    // The real PATCH checks the ticked ids against the live OnlySocials list, which the suite cannot reach.
    let patched: Record<string, unknown> | null = null;
    await page.route(`**/api/v2/social-posts/${post.dealId}`, async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      patched = route.request().postDataJSON() as Record<string, unknown>;
      return json(route, { success: true, data: { id: post.dealId, quote_id: post.quoteId } });
    });
    await openEditor(page, post.quoteId);

    await account(page, IG).click();
    await page.getByTestId("button-save-draft").click();
    await expectToast(page, "Draft saved");

    expect(patched).toMatchObject({ accountIds: [FB_PAGE] });
    expect(Object.keys(patched ?? {}).sort()).toEqual(["accountIds", "post"]);
  });

  test("a post with saved targets opens with exactly those accounts ticked", async ({ page }) => {
    const agency = await world(page);
    const post = await seedSocialPost({
      userId: agency.adminId, orgId: agency.orgId, branchId: agency.branchId, title: "Saved targets",
      withImage: true, targets: [{ accountId: IG, platform: "instagram" }],
    });
    await fakeOnlySocials(page);
    await openEditor(page, post.quoteId);

    await expect(account(page, IG)).toHaveAttribute("aria-checked", "true");
    await expect(account(page, FB_PAGE)).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText("Posts to Instagram.")).toBeVisible();
  });

  test("a legacy scheduled post (no saved targets) opens with only its Facebook Page ticked", async ({ page }) => {
    const agency = await world(page);
    const post = await seedSocialPost({
      userId: agency.adminId, orgId: agency.orgId, branchId: agency.branchId, title: "Legacy scheduled",
      withImage: true, scheduledAt: new Date(Date.now() + 5 * 24 * 3600 * 1000), targets: null,
    });
    await fakeOnlySocials(page);
    await openEditor(page, post.quoteId);

    await expect(account(page, FB_PAGE)).toHaveAttribute("aria-checked", "true");
    await expect(account(page, IG)).toHaveAttribute("aria-checked", "false");
  });
});

test.describe("account loading", () => {
  test("when the account list cannot load, the editor says so, blocks Schedule, and Retry recovers", async ({ page }) => {
    const agency = await world(page);
    const post = await seedSocialPost({ userId: agency.adminId, orgId: agency.orgId, branchId: agency.branchId, title: "Accounts down", withImage: true });
    await fakeOnlySocials(page);
    let down = true;
    await page.route("**/api/v2/social-settings/accounts**", (route) =>
      down
        ? json(route, { success: false, message: "Couldn't load connected accounts" }, 502)
        : json(route, { success: true, data: { configured: true, accounts: ACCOUNTS } }),
    );
    await openEditorNoPicker(page, post.quoteId);

    await expect(page.getByTestId("platform-load-error")).toContainText("Couldn't load connected accounts");
    await fillSchedule(page);
    await expect(page.getByTestId("button-save-and-schedule")).toBeDisabled();

    down = false;
    await page.getByTestId("button-retry-accounts").click();
    await expect(account(page, FB_PAGE)).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("button-save-and-schedule")).toBeEnabled();
  });
});

test.describe("platform dots", () => {
  test("cards and the calendar show a dot per platform the post goes to; legacy posts show Facebook", async ({ page }) => {
    const agency = await world(page);
    const soon = new Date(Date.now() + 2 * 3600 * 1000);
    const both = await seedSocialPost({
      userId: agency.adminId, orgId: agency.orgId, branchId: agency.branchId, title: "Dots both",
      withImage: true, scheduledAt: soon,
      targets: [{ accountId: FB_PAGE, platform: "facebook" }, { accountId: IG, platform: "instagram" }],
    });
    const igOnly = await seedSocialPost({
      userId: agency.adminId, orgId: agency.orgId, branchId: agency.branchId, title: "Dots instagram",
      withImage: true, scheduledAt: soon, targets: [{ accountId: IG, platform: "instagram" }],
    });
    const legacy = await seedSocialPost({
      // Weeks away, so it stays off this month's calendar (a month cell only shows two chips).
      userId: agency.adminId, orgId: agency.orgId, branchId: agency.branchId, title: "Dots legacy",
      withImage: true, scheduledAt: new Date(Date.now() + 45 * 24 * 3600 * 1000), targets: null,
    });
    await fakeOnlySocials(page);

    await page.goto("/social-posts");
    const dots = (quoteId: string, name: "Facebook" | "Instagram") =>
      page.getByTestId(`card-social-post-${quoteId}`).getByRole("img", { name, exact: true });
    await expect(dots(both.quoteId, "Facebook")).toBeVisible();
    await expect(dots(both.quoteId, "Instagram")).toBeVisible();
    await expect(dots(igOnly.quoteId, "Instagram")).toBeVisible();
    await expect(dots(igOnly.quoteId, "Facebook")).toHaveCount(0);
    await expect(dots(legacy.quoteId, "Facebook")).toBeVisible();
    await expect(dots(legacy.quoteId, "Instagram")).toHaveCount(0);

    await page.goto("/social-posts/calendar");
    // Two hours from now can land in the next month on the last day of a month.
    const now = new Date();
    if (soon.getMonth() !== now.getMonth()) await page.getByRole("button", { name: "Next" }).click();
    const chip = page.getByRole("button", { name: /Dots both/ });
    await expect(chip).toBeVisible();
    await expect(chip.getByRole("img", { name: "Facebook", exact: true })).toBeVisible();
    await expect(chip.getByRole("img", { name: "Instagram", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Dots instagram/ }).getByRole("img", { name: "Facebook", exact: true })).toHaveCount(0);
  });
});

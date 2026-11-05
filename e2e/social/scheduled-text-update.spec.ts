/**
 * "Save changes" on an already scheduled post.
 *
 * OnlySocials can never be reached from the suite, so for a post that is still waiting to go out the PATCH
 * (which the real server pushes to OnlySocials first) is answered with page.route(), both ways:
 *   - success: the editor reads "Save changes", sends only the text, says the scheduled post was updated;
 *   - failure: the clear error shows, the editor stays open, and nothing is saved locally.
 * A post whose time has passed never calls OnlySocials, so that case runs against the real server.
 */
import type { Page, Route } from "@playwright/test";
import { signIn } from "../helpers/deals";
import { expect, expectToast, test } from "../helpers/fixtures";
import { dbDeal, seedDealsAgency, seedSocialPost } from "../helpers/seed";

const FB_PAGE = 81085;

const json = (route: Route, data: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });

async function fakeOnlySocialsReads(page: Page): Promise<void> {
  await page.route("**/api/v2/social-settings/accounts**", (route) =>
    json(route, {
      success: true,
      data: { configured: true, accounts: [{ id: FB_PAGE, name: "E2E Travel Page", username: null, image: null, platform: "facebook", authorized: true, selectable: true }] },
    }),
  );
  await page.route("**/api/v2/social-settings/channel", (route) =>
    json(route, {
      success: true,
      data: { provider: "onlysocials", accountId: FB_PAGE, workspaceConfigured: true, apiKeyConfigured: true, label: "Facebook Page via OnlySocials" },
    }),
  );
  await page.route("**/api/v2/social-posts/*/media", (route) => json(route, { success: true, data: { media: [], postContent: "" } }));
}

async function openAndEdit(page: Page, quoteId: string): Promise<void> {
  await page.goto("/social-posts");
  await page.getByTestId(`button-edit-post-${quoteId}`).click();
  await expect(page.getByTestId("dialog-social-post-preview")).toBeVisible();
  const editor = page.getByTestId("editor-post-content");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" EXTRA-WORDS");
}

async function scheduledWorld(page: Page, when: Date, title: string) {
  const agency = await seedDealsAgency();
  await signIn(page, agency.adminEmail);
  const post = await seedSocialPost({
    userId: agency.adminId, orgId: agency.orgId, branchId: agency.branchId, title,
    withImage: true, scheduledAt: when, targets: [{ accountId: FB_PAGE, platform: "facebook" }],
  });
  await fakeOnlySocialsReads(page);
  return post;
}

test.describe("saving text on a scheduled post", () => {
  test("a post still waiting to go out reads Save changes, sends only the text, and says the scheduled post was updated", async ({ page }) => {
    const post = await scheduledWorld(page, new Date(Date.now() + 5 * 24 * 3600 * 1000), "Scheduled text update");
    let patched: Record<string, unknown> | null = null;
    await page.route(`**/api/v2/social-posts/${post.dealId}`, async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      patched = route.request().postDataJSON() as Record<string, unknown>;
      return json(route, { success: true, data: { id: post.dealId, quote_id: post.quoteId, onlySocialsId: "os-fake" } });
    });

    await openAndEdit(page, post.quoteId);
    await expect(page.getByTestId("button-save-draft")).toHaveText("Save changes");
    await page.getByTestId("button-save-draft").click();

    await expectToast(page, "Scheduled post updated");
    expect(Object.keys(patched ?? {})).toEqual(["post"]);
    expect(String((patched as Record<string, unknown> | null)?.post)).toContain("EXTRA-WORDS");
    await expect(page.getByTestId("dialog-social-post-preview")).toBeHidden();
  });

  test("when OnlySocials refuses, the clear error shows, the editor stays open and the text is not saved", async ({ page }) => {
    const post = await scheduledWorld(page, new Date(Date.now() + 5 * 24 * 3600 * 1000), "Scheduled text failure");
    const before = (await dbDeal(post.dealId)).post;
    const message = "Couldn't update the scheduled post on Facebook/Instagram — nothing was changed";
    await page.route(`**/api/v2/social-posts/${post.dealId}`, async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      return json(route, { success: false, message }, 502);
    });

    await openAndEdit(page, post.quoteId);
    await page.getByTestId("button-save-draft").click();

    await expectToast(page, message);
    await expect(page.getByTestId("dialog-social-post-preview")).toBeVisible();
    expect((await dbDeal(post.dealId)).post).toBe(before);
  });

  test("a post whose time has passed keeps the old behaviour: text saved here only, and the toast says so", async ({ page }) => {
    const post = await scheduledWorld(page, new Date(Date.now() - 2 * 24 * 3600 * 1000), "Already posted");

    await openAndEdit(page, post.quoteId);
    await expect(page.getByTestId("button-save-draft")).toHaveText("Save text as draft");
    await page.getByTestId("button-save-draft").click();

    await expectToast(page, "This post has already gone out");
    await expect.poll(async () => (await dbDeal(post.dealId)).post).toContain("EXTRA-WORDS");
  });
});

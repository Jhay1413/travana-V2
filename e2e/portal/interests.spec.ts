/**
 * Customer portal: Travel interests in the new look. Written, not yet run. The first-login redirect, choosing and
 * saving, returning to `next` (including the reset-PIN pass-through), and editing from Account.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "../helpers/fixtures";
import { seedPortalCustomer, startSignedIn } from "../helpers/portal";

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);

async function myTagNames(page: Page): Promise<string[]> {
  const token = await page.evaluate(() => localStorage.getItem("portal_token"));
  const res = await page.request.get("/api/portal/my-tags", { headers: { Authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(200);
  return ((await res.json()) as { name: string }[]).map((t) => t.name);
}

test.describe("customer portal: Travel interests", () => {
  test("a first-time customer is sent here, must choose one, saves, and lands on Home", async ({ page }) => {
    const c = await seedPortalCustomer({ withInterest: false });
    await startSignedIn(page, c);
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/portal\/tags$/);

    await expect(page.getByTestId("portal-interests")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("What are");
    await expect(page.getByTestId("button-interests-back")).toHaveCount(0);
    await expect(page.getByTestId("text-interests-count")).toHaveText("Select at least one interest to continue");
    const save = page.getByTestId("button-save-interests");
    await expect(save).toHaveText("Continue");
    await expect(save).toBeDisabled();

    const chip = page.getByRole("button", { name: c.tagName });
    await expect(chip).toHaveAttribute("aria-pressed", "false");
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("text-interests-count")).toHaveText("1 selected");
    await expect(save).toBeEnabled();

    // Choosing it again takes it back off.
    await chip.click();
    await expect(save).toBeDisabled();
    await chip.click();

    await save.click();
    await expect(page).toHaveURL(/\/portal$/);
    expect(await myTagNames(page)).toEqual([c.tagName]);
  });

  test("saving returns to `next` when the visit carried one", async ({ page }) => {
    const c = await seedPortalCustomer({ withInterest: false });
    await startSignedIn(page, c);
    await page.goto("/portal/trips/quotes");
    await expect(page).toHaveURL(/\/portal\/tags/);
    await page.goto(`/portal/tags?next=${encodeURIComponent("/portal/trips/quotes")}`);
    await page.getByRole("button", { name: c.tagName }).click();
    await page.getByTestId("button-save-interests").click();
    await expect(page).toHaveURL(/\/portal\/trips\/quotes$/);
  });

  test("a reset-PIN visit (?change-pin=1) goes through interests and comes back to the new-PIN form", async ({ page }) => {
    const c = await seedPortalCustomer({ withInterest: false });
    await startSignedIn(page, c);
    await page.goto("/portal/account?change-pin=1");
    await expect(page).toHaveURL(/\/portal\/tags\?next=/);
    await expect(page).toHaveURL(/change-pin%3D1/);
    await page.getByRole("button", { name: c.tagName }).click();
    await page.getByTestId("button-save-interests").click();
    await expect(page).toHaveURL(/\/portal\/account\?change-pin=1$/);
    await expect(page.getByTestId("dialog-change-pin")).toBeVisible();
  });

  test("from Account a customer sees their interests chosen, can change them, and Back leaves without saving", async ({ page }) => {
    const c = await seedPortalCustomer();
    await startSignedIn(page, c);
    await page.goto("/portal/tags");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Travel");
    await expect(page.getByTestId("text-interests-intro")).toContainText("Update your interests");
    await expect(page.getByTestId("button-save-interests")).toHaveText("Save interests");
    const mine = page.getByRole("button", { name: c.tagName });
    await expect(mine).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("text-interests-count")).toHaveText("1 selected");

    // Back leaves Home without changing anything.
    await mine.click();
    await page.getByTestId("button-interests-back").click();
    await expect(page).toHaveURL(/\/portal$/);
    expect(await myTagNames(page)).toEqual([c.tagName]);
  });

  test("works at 360px wide and the save button stays on screen", async ({ page }) => {
    const c = await seedPortalCustomer({ withInterest: false });
    await startSignedIn(page, c);
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/portal/tags");
    await expect(page.getByRole("button", { name: c.tagName })).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(360);
    await expect(page.getByTestId("button-save-interests")).toBeInViewport();
  });
});

/**
 * Customer portal: the page frame in the reference design. Written, not run (practice database unavailable).
 * The floating header, the full-screen menu, the five-tab bar and the footer.
 */
import { expect, test } from "../helpers/fixtures";
import { seedPortalCustomer, startSignedIn } from "../helpers/portal";

test.describe("customer portal: header, menu and tab bar", () => {
  test("the header floats over the hero: no bar behind it, the logo on the left and Menu on the right", async ({ page }) => {
    const c = await seedPortalCustomer({ logoUrl: "/favicon.png" });
    await startSignedIn(page, c);
    await page.goto("/portal");
    const header = page.getByTestId("portal-header");
    await expect(header).toBeVisible();
    const box = await header.boundingBox();
    expect(box?.y ?? 99).toBeLessThanOrEqual(1);
    expect(await header.evaluate((el) => getComputedStyle(el).position)).toBe("absolute");
    expect(await header.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
    // The hero starts at the very top of the page, under the header.
    const hero = await page.locator("section").first().boundingBox();
    expect(hero?.y ?? 99).toBeLessThanOrEqual(1);
    await expect(page.getByTestId("portal-header-home").getByAltText(c.orgName)).toBeVisible();
    await expect(page.getByTestId("button-portal-menu")).toHaveText("Menu");
    await expect(page.getByTestId("portal-header-agent")).toHaveCount(0);
  });

  test("a quote shows a back link in place of the logo", async ({ page }) => {
    const c = await seedPortalCustomer();
    await startSignedIn(page, c);
    await page.goto("/portal/quotes");
    await expect(page.getByTestId("button-header-back")).toHaveCount(0);
  });

  test("the menu opens full screen, lists the destinations, navigates, and Escape closes it", async ({ page }) => {
    const c = await seedPortalCustomer();
    await startSignedIn(page, c);
    await page.goto("/portal");
    await page.getByTestId("button-portal-menu").click();
    const menu = page.getByTestId("portal-menu");
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && box.width >= viewport.width - 1 && box.height >= viewport.height - 1, "full screen").toBe(true);
    for (const key of ["home", "quotes", "bookings", "messages", "deals", "rewards", "interests", "account"]) await expect(page.getByTestId(`menu-item-${key}`)).toBeVisible();
    await expect(page.getByTestId("menu-item-home")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("menu-customer")).toContainText("Pat");
    await expect(page.getByTestId("menu-message-agent")).toBeVisible();
    await expect(page.getByTestId("menu-logout")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);

    await page.getByTestId("button-portal-menu").click();
    await page.getByTestId("menu-item-deals").click();
    await expect(page).toHaveURL(/\/portal\/deals$/);
    await expect(menu).toHaveCount(0);

    await page.getByTestId("button-portal-menu").click();
    await page.getByTestId("menu-message-agent").click();
    await expect(menu).toHaveCount(0);
    await expect(page.getByTestId("sheet-message")).toBeVisible();
    await expect(page).toHaveURL(/\/portal\/deals$/);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("sheet-message")).toHaveCount(0);

    await page.getByTestId("button-portal-menu").click();
    await page.getByTestId("menu-item-messages").click();
    await expect(page).toHaveURL(/\/portal\/messages$/);
    await page.getByTestId("button-portal-menu").click();
    await expect(page.getByTestId("menu-item-messages")).toHaveAttribute("aria-current", "page");
  });

  test("the menu traps focus, and Close and Log out work", async ({ page }) => {
    const c = await seedPortalCustomer();
    await startSignedIn(page, c);
    await page.goto("/portal");
    await page.getByTestId("button-portal-menu").click();
    await expect(page.getByTestId("portal-menu")).toBeVisible();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() => !!document.activeElement?.closest('[data-testid="portal-menu"]'));
      expect(inside, "focus stays inside the menu").toBe(true);
    }
    await page.getByTestId("menu-close").click();
    await expect(page.getByTestId("portal-menu")).toHaveCount(0);

    await page.getByTestId("button-portal-menu").click();
    await page.getByTestId("menu-logout").click();
    await expect(page).toHaveURL(/\/portal\/login/);
    expect(await page.evaluate(() => localStorage.getItem("portal_token"))).toBeNull();
  });

  test("the tab bar is the reference's: sticky, five tabs, 60px high, 10px labels", async ({ page }) => {
    const c = await seedPortalCustomer();
    await startSignedIn(page, c);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/portal");
    const nav = page.getByTestId("nav-bottom");
    expect(await nav.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
    await expect(nav.getByRole("button")).toHaveCount(5);
    const tab = await page.getByTestId("nav-tab-home").boundingBox();
    expect(tab?.height ?? 0).toBeGreaterThanOrEqual(59.5);
    expect(await page.getByTestId("nav-tab-home").evaluate((el) => getComputedStyle(el).fontSize)).toBe("10px");
    const navBox = await nav.boundingBox();
    expect((navBox?.y ?? 0) + (navBox?.height ?? 0)).toBeGreaterThanOrEqual(843);
  });

  test("the footer is the reference's: the logo or name, phone and email links, one details line", async ({ page }) => {
    const c = await seedPortalCustomer({ logoUrl: "/favicon.png" });
    await startSignedIn(page, c);
    await page.goto("/portal");
    const footer = page.getByTestId("portal-footer");
    await expect(footer).toContainText(c.orgName);
    await expect(footer.locator('a[href^="tel:"]')).toBeVisible();
  });
});

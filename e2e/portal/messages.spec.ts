/**
 * Customer portal: the Messages tab in the new look. Written, not yet run. Sending, the `?about=` prefill, the
 * agent's messages and day separators, a failed send, long text, and the composer above the tab bar at 360px.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "../helpers/fixtures";
import { seedPortalCustomer, startSignedIn, type PortalSetup } from "../helpers/portal";
import { portalConversation, seedAgentMessage } from "../helpers/portal-screens";

async function signedIn(page: Page): Promise<PortalSetup> {
  const c = await seedPortalCustomer();
  await startSignedIn(page, c);
  return c;
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);

test.describe("customer portal: Messages", () => {
  test("sending a message shows it in the chat, clears the box and saves it once", async ({ page }) => {
    const c = await signedIn(page);
    await page.goto("/portal/messages");
    await expect(page.getByTestId("portal-messages")).toBeVisible();
    await expect(page.getByTestId("nav-tab-messages")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("text-empty-messages")).toBeVisible();
    // Nothing to send yet.
    await expect(page.getByTestId("button-send-message")).toBeDisabled();

    await page.getByTestId("input-message").fill("Hello, can you help with a holiday?");
    await page.getByTestId("button-send-message").click();
    await expect(page.getByTestId("message-log")).toContainText("Hello, can you help with a holiday?");
    await expect(page.getByTestId("input-message")).toHaveValue("");

    await expect.poll(async () => (await portalConversation(c.clientId)).filter((m) => m.sender === "client").map((m) => m.text)).toEqual(["Hello, can you help with a holiday?"]);
    // Still one bubble after the next 5-second refresh from the server.
    await page.waitForTimeout(6000);
    await expect(page.getByTestId("message-log").getByText("Hello, can you help with a holiday?")).toHaveCount(1);
  });

  test("Enter sends and Shift+Enter adds a line", async ({ page }) => {
    const c = await signedIn(page);
    await page.goto("/portal/messages");
    const box = page.getByTestId("input-message");
    await box.fill("Line one");
    await box.press("Shift+Enter");
    await box.pressSequentially("Line two");
    await expect(box).toHaveValue("Line one\nLine two");
    await box.press("Enter");
    await expect(box).toHaveValue("");
    await expect.poll(async () => (await portalConversation(c.clientId)).length).toBe(1);
  });

  test("opened from a quote (?about=), the box starts with 'About <title>: '", async ({ page }) => {
    await signedIn(page);
    await page.goto("/portal/messages?about=Hotel%20Playa%20Azul%20Majorca");
    await expect(page.getByTestId("input-message")).toHaveValue("About Hotel Playa Azul Majorca: ");
    await page.goto("/portal/messages");
    await expect(page.getByTestId("input-message")).toHaveValue("");
  });

  test("the agent's messages are on sand with the agent's name, grouped under a day heading", async ({ page }) => {
    const c = await signedIn(page);
    await seedAgentMessage(c.clientId, "Welcome back, here to help.", "Sam Agent", 3 * 24 * 60);
    await seedAgentMessage(c.clientId, "Your quote is ready to look at.", "Sam Agent", 1);
    await page.goto("/portal/messages");
    const log = page.getByTestId("message-log");
    await expect(log).toContainText("Welcome back, here to help.");
    await expect(log).toContainText("Your quote is ready to look at.");
    await expect(log).toContainText("Sam Agent");
    await expect(page.getByTestId("message-day-label")).toHaveCount(2);
    await expect(page.getByTestId("message-day-label").last()).toHaveText("Today");
  });

  test("a failed send is marked 'Not sent', and 'Send again' delivers it once", async ({ page }) => {
    const c = await signedIn(page);
    await page.goto("/portal/messages");
    await page.route("**/api/portal/message", (route) => route.abort());
    await page.getByTestId("input-message").fill("Is this arriving?");
    await page.getByTestId("button-send-message").click();
    await expect(page.getByText("Not sent.")).toBeVisible();
    expect(await portalConversation(c.clientId)).toEqual([]);

    await page.unroute("**/api/portal/message");
    await page.getByRole("button", { name: "Send again" }).click();
    await expect(page.getByText("Not sent.")).toHaveCount(0);
    await expect.poll(async () => (await portalConversation(c.clientId)).map((m) => m.text)).toEqual(["Is this arriving?"]);
  });

  test("long words and links wrap inside the bubble at 360px", async ({ page }) => {
    await signedIn(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/portal/messages");
    const long = `https://example.test/${"averyverylongpath".repeat(12)} ${"x".repeat(200)}`;
    await page.getByTestId("input-message").fill(long);
    await page.getByTestId("button-send-message").click();
    const bubble = page.getByTestId("message-log").locator('[data-testid^="text-message-"]').first();
    await expect(bubble).toBeVisible();
    await page.waitForTimeout(600); // let the page and the new bubble finish sliding in
    const box = await bubble.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 360, `bubble box ${JSON.stringify(box)} is inside the 360px screen`).toBe(true);
    expect(await overflow(page)).toBeLessThanOrEqual(360);
  });

  const SIZES = [
    { name: "360x640", width: 360, height: 640 },
    { name: "390x844", width: 390, height: 844 },
    { name: "1280x800", width: 1280, height: 800 },
  ];

  /** The composer ends at or above the tab bar, the page does not scroll, and Send can really be clicked (nothing covers it). */
  async function expectComposerAboveTabBar(page: Page, height: number) {
    const composer = page.getByTestId("message-composer");
    const nav = page.getByTestId("nav-bottom");
    await expect(composer).toBeVisible();
    // The page fades and slides in over 0.2s; measure once it has settled.
    await page.waitForTimeout(600);
    const c = await composer.boundingBox();
    const n = await nav.boundingBox();
    expect(c && n && c.y + c.height <= n.y + 0.5, `composer ${JSON.stringify(c)} ends above the tab bar ${JSON.stringify(n)}`).toBe(true);
    expect(c && c.y >= 0).toBe(true);
    await expect(page.getByTestId("portal-footer")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(height + 1);
    await page.getByTestId("input-message").fill("Can you hear me?");
    await page.getByTestId("button-send-message").click({ timeout: 3000 });
    await expect(page.getByTestId("message-log")).toContainText("Can you hear me?");
  }

  for (const size of SIZES) {
    test(`at ${size.name} the composer is on screen, above the tab bar, Send is clickable and the page does not scroll`, async ({ page }) => {
      await signedIn(page);
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/portal/messages");
      await expectComposerAboveTabBar(page, size.height);
    });
  }

  test("with a long two-line agency name in the header, the composer is still above the tab bar at 360px", async ({ page }) => {
    const c = await seedPortalCustomer({ orgName: "The Extraordinarily Long Named Holiday Travel Company Of Somewhere Far Away" });
    await startSignedIn(page, c);
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/portal/messages");
    const header = await page.getByTestId("portal-header-home").boundingBox();
    expect(header && header.height > 70, "the header really is taller than the usual one").toBe(true);
    await expectComposerAboveTabBar(page, 640);
  });

  test("the message list is the only thing that scrolls, and it ends on the newest message", async ({ page }) => {
    const c = await signedIn(page);
    for (let i = 1; i <= 25; i++) await seedAgentMessage(c.clientId, `Message number ${i}`, "Sam Agent", 60 - i);
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/portal/messages");
    await expect(page.getByTestId("message-log")).toContainText("Message number 25");
    await expect(page.getByText("Message number 25")).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(641);
    const scrolls = await page.getByTestId("message-log").evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(scrolls).toBe(true);
  });
});

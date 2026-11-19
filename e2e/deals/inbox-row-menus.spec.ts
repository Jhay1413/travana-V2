import type { Locator, Page } from "@playwright/test";
import { apiCreateClient, signIn } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { INBOX_CONVERSATION_ID, PACKAGE_INTENT, stubInbox } from "../helpers/inbox";
import { seedDealsAgency } from "../helpers/seed";

/**
 * The hover actions on an inbox row (snooze / done / assign). Their menus are positioned against the trigger button,
 * which only shows while the row is hovered — so the menu must keep the actions on screen once it is open, or it
 * loses its anchor and jumps to the corner of the page as soon as the pointer moves into it.
 */

async function openInboxRow(page: Page): Promise<Locator> {
  const agency = await seedDealsAgency();
  await signIn(page, agency.agentEmail);
  const client = await apiCreateClient(page.request);
  await stubInbox(page, { client, intent: PACKAGE_INTENT });
  await page.goto("/conversations");
  const row = page.getByTestId(`conversation-row-${INBOX_CONVERSATION_ID}`);
  await expect(row).toBeVisible();
  return row;
}

async function expectMenuStaysAnchored(page: Page, row: Locator, triggerName: string): Promise<void> {
  await row.hover();
  // Not getByRole: an open menu hides the rest of the page from assistive tech, the trigger included.
  const trigger = row.locator(`button[aria-label="${triggerName}"]`);
  await trigger.click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();

  // Move the pointer off the row and into the menu, as an agent picking an option does.
  await menu.getByRole("menuitem").first().hover();

  await expect(trigger).toBeVisible();
  await expect(menu).toBeVisible();
  const t = await trigger.boundingBox();
  const m = await menu.boundingBox();
  expect(t).not.toBeNull();
  expect(m).not.toBeNull();
  // Opens directly under (or, with no room, directly over) the button, right edges lined up.
  const gapBelow = Math.abs(m!.y - (t!.y + t!.height));
  const gapAbove = Math.abs(m!.y + m!.height - t!.y);
  expect(Math.min(gapBelow, gapAbove)).toBeLessThan(16);
  expect(Math.abs(m!.x + m!.width - (t!.x + t!.width))).toBeLessThan(16);
}

test.describe("inbox: row hover menus", () => {
  test("the snooze menu stays attached to the clock button when the pointer moves into it", async ({ page }) => {
    const row = await openInboxRow(page);
    await expectMenuStaysAnchored(page, row, "Snooze");
  });

  test("the assign menu stays attached to its button when the pointer moves into it", async ({ page }) => {
    const row = await openInboxRow(page);
    await expectMenuStaysAnchored(page, row, "Assign");
  });
});

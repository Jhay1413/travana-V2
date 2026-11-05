/** The notifications panel: Unread / Read tabs, the tick moves an item across, and the bell badge counts unread only. */
import { expect, test } from "../helpers/fixtures";
import { boardWorld } from "../helpers/pipeline";
import { queryRows, unique } from "../helpers/seed";

async function seedNotification(userId: string, title: string, read = false): Promise<string> {
  const rows = await queryRows<{ id: string }>(
    `insert into notifications (user_id, type, title, message, read) values ($1, 'task_assigned', $2, 'Seeded by e2e', $3) returning id`,
    [userId, title, read],
  );
  return rows[0].id;
}

test.describe("notifications panel tabs", () => {
  test("the tick moves a notification from Unread to Read and the bell badge goes down", async ({ page }) => {
    const w = await boardWorld(page);
    const a = await seedNotification(w.userId, unique("first"));
    const b = await seedNotification(w.userId, unique("second"));
    const old = await seedNotification(w.userId, unique("old"), true);
    await page.goto("/pipeline");

    const badge = page.getByTestId("badge-notifications-unread");
    await expect(badge).toHaveText("2");
    await page.getByTestId("button-notifications").click();
    const panel = page.getByTestId("panel-notifications");

    // Unread is the default tab and only shows unread items.
    await expect(page.getByTestId("notifications-tab-unread")).toHaveAttribute("aria-selected", "true");
    await expect(panel.getByTestId(`notification-${a}`)).toBeVisible();
    await expect(panel.getByTestId(`notification-${b}`)).toBeVisible();
    await expect(panel.getByTestId(`notification-${old}`)).toHaveCount(0);

    await panel.getByTestId(`button-notification-read-${a}`).click();
    await expect(panel.getByTestId(`notification-${a}`)).toHaveCount(0);
    await expect(badge).toHaveText("1");
    await expect.poll(async () => (await queryRows<{ read: boolean }>(`select read from notifications where id = $1`, [a]))[0].read).toBe(true);

    await page.getByTestId("notifications-tab-read").click();
    await expect(panel.getByTestId(`notification-${a}`)).toBeVisible();
    await expect(panel.getByTestId(`notification-${old}`)).toBeVisible();
    await expect(panel.getByTestId(`notification-${b}`)).toHaveCount(0);
    await expect(panel.getByTestId(`button-notification-read-${a}`)).toHaveCount(0); // no tick on read items

    // The X still deletes.
    await panel.getByTestId(`button-notification-delete-${old}`).click();
    await expect(panel.getByTestId(`notification-${old}`)).toHaveCount(0);
    expect(await queryRows(`select 1 from notifications where id = $1`, [old])).toHaveLength(0);
  });

  test("both tabs have an empty state, and Mark all read empties Unread", async ({ page }) => {
    const w = await boardWorld(page);
    const a = await seedNotification(w.userId, unique("one"));
    await page.goto("/pipeline");
    await page.getByTestId("button-notifications").click();
    const panel = page.getByTestId("panel-notifications");

    await page.getByTestId("notifications-tab-read").click();
    await expect(panel.getByTestId("notifications-empty-read")).toBeVisible();

    await page.getByTestId("notifications-tab-unread").click();
    await expect(panel.getByTestId(`notification-${a}`)).toBeVisible();
    await panel.getByTestId("button-mark-all-read").click();
    await expect(panel.getByTestId("notifications-empty-unread")).toBeVisible();
    await expect(page.getByTestId("badge-notifications-unread")).toHaveCount(0);

    await page.getByTestId("notifications-tab-read").click();
    await expect(panel.getByTestId(`notification-${a}`)).toBeVisible();
  });
});

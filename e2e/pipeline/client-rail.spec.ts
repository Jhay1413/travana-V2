import { expect, test } from "../helpers/fixtures";
import { boardWorld, bookedDeal } from "../helpers/pipeline";

test.describe("client page live deals rail", () => {
  test("a booking row shows its price but no profit line", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await bookedDeal(page.request, w, { sales_price: "3000", package_commission: "240" });
    await page.goto(`/clients/${w.clientId}`);
    await page.getByTestId("all-holidays-tab-bookings").click();
    const rail = page.getByTestId("all-holidays-panel");
    await expect(rail.locator('[data-testid^="all-holidays-row-"]').filter({ hasText: deal.title })).toBeVisible();
    await expect(rail.getByTestId("booking-row-profit")).toHaveCount(0);
    await expect(rail).not.toContainText("Profit");
  });
});

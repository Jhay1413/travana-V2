import type { Locator, Page } from "@playwright/test";
import { apiCreateClient, apiCreateQuoteDeal, openActionsMenu, openHoliday, signIn } from "../helpers/deals";
import { expect, expectToast, test } from "../helpers/fixtures";
import { queryRows, seedDealsAgency, unique } from "../helpers/seed";
import { chooseOption, pickDate } from "../helpers/ui";

/** Upsells entered on Create Booking are saved, and the quote form's Total Profit includes extras commission. */

test.describe("create booking with an upsell", () => {
  test("the upsell is saved with the booking and shows on the booking page Costings tab", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const title = `Upsell ${unique("u")}`;

    await page.goto(`/clients/${client.id}`);
    await page.getByTestId("client-index-create").click();
    await page.getByTestId("client-index-create-booking").click();
    const drawer = page.getByTestId("booking-create-drawer");
    await expect(drawer).toBeVisible();
    await drawer.getByLabel("Hays Ref").fill("hay 2468013");
    await drawer.getByLabel("Supplier Ref").fill("SUP-UP");
    await drawer.getByTestId("input-drawer-title").fill(title);
    await chooseOption(page, drawer.getByLabel("Holiday Type"), "Package Holiday");
    await pickDate(page, drawer.getByLabel("Travel Date"), "2027-09-10");
    await drawer.getByTestId("drawer-costing-price").fill("1999");

    const section = drawer.getByTestId("drawer-section-upsells");
    await section.getByRole("button", { name: "Expand section" }).click();
    await section.getByTestId("button-add-upsell").click();
    const card = section.getByTestId("card-upsell-0");
    await card.getByPlaceholder(/extra nights/i).fill("E2E seat upgrade");
    await card.getByLabel("Cost (£)").fill("40");
    await card.getByLabel("Commission (£)").fill("15");

    await drawer.getByTestId("form-drawer-submit").click();
    await expectToast(page, "Booking created");

    const [booking] = await queryRows<{ id: string }>(`select id from booking_table where title = $1`, [title]);
    await expect
      .poll(async () =>
        (await queryRows<{ description: string }>(`select description from booking_upsell where booking_id = $1 and is_active = true`, [booking.id])).map((r) => r.description),
      )
      .toEqual(["E2E seat upgrade"]);

    await openHoliday(page, client.id, "booking", booking.id);
    await page.getByTestId("holiday-trip-costings-tab-costings").click();
    const upsells = page.getByTestId("money-upsells");
    await expect(upsells).toBeVisible();
    await expect(upsells).toContainText("£15.00");
  });
});

test.describe("quote form Total Profit", () => {
  async function openEditDrawer(page: Page, clientId: string, quoteId: string): Promise<Locator> {
    await openHoliday(page, clientId, "quote", quoteId);
    await openActionsMenu(page);
    await page.getByRole("menuitem", { name: "Edit Quote" }).click();
    const drawer = page.getByTestId("quote-edit-drawer");
    await expect(drawer).toBeVisible();
    return drawer;
  }

  test("an extra's commission raises Total Profit, and the saved deal shows the same profit", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const { quoteId } = await apiCreateQuoteDeal(page.request, agency, client.id, userId, {
      title: `Profit ${unique("p")}`,
      sales_price: "2400.00",
      package_commission: "240.00",
    });

    const drawer = await openEditDrawer(page, client.id, quoteId);
    const profit = drawer.getByTestId("drawer-total-profit");
    await expect(profit).toHaveText("£240.00");

    const extras = drawer.getByTestId("drawer-section-extras");
    if ((await extras.getAttribute("data-state")) === "closed") {
      await extras.getByRole("button", { name: "Expand section" }).click();
    }
    await extras.getByRole("button", { name: "Transfer", exact: true }).click();
    // New extras default to "Included in package" (commission locked to 0): turn it off to enter a commission.
    await extras.getByRole("switch").click();
    await extras.getByLabel("Commission (£)").fill("35");
    await expect(profit).toHaveText("£275.00");

    await drawer.getByTestId("form-drawer-submit").click();
    await expectToast(page, "Quote updated");

    await openHoliday(page, client.id, "quote", quoteId);
    await page.getByTestId("holiday-trip-costings-tab-costings").click();
    await expect(page.getByTestId("holiday-money-card")).toContainText("Your profit");
    await expect(page.getByTestId("holiday-money-card")).toContainText("£275.00");

    const [saved] = await queryRows<{ package_commission: string; extras: string }>(
      `select package_commission, (select coalesce(sum(commission::numeric), 0) from quote_transfers where quote_id = $1)::text as extras from quote_table where id = $1`,
      [quoteId],
    );
    expect(Number(saved.package_commission) + Number(saved.extras)).toBe(275);

    // Re-opening the form shows the same figure the saved deal does.
    const again = await openEditDrawer(page, client.id, quoteId);
    await expect(again.getByTestId("drawer-total-profit")).toHaveText("£275.00");
  });
});

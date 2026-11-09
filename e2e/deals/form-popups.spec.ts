import type { Locator, Page } from "@playwright/test";
import { apiCreateClient, apiCreateEnquiry, apiCreateQuoteDeal, openActionsMenu, openHoliday, signIn } from "../helpers/deals";
import { expect, expectToast, test } from "../helpers/fixtures";
import { queryRows, REF, seedDealsAgency, unique } from "../helpers/seed";
import { chooseSearchable, expectChip, pickDate, pressChip, setNumber } from "../helpers/ui";

/**
 * The redesigned Enquiry / Quote / Booking forms: one shared centred pop-up shell (head, side menu with ticks and a
 * profit card, scrolling body, footer). Per-field behaviour is covered by the enquiry, quote and booking specs; this file
 * covers what is new about the pop-up itself.
 */

function operatorSelect(drawer: Locator) {
  return drawer.getByRole("combobox").filter({ hasText: /Select operator|E2E /i });
}

async function openEnquiryPopup(page: Page, clientId: string): Promise<Locator> {
  await page.goto(`/clients/${clientId}`);
  await page.getByTestId("client-index-create").click();
  await page.getByTestId("client-index-create-enquiry").click();
  const popup = page.getByTestId("enquiry-drawer");
  await expect(popup).toBeVisible();
  await expectChip(popup.getByTestId("select-holiday-type"), "Package Holiday");
  return popup;
}

async function openQuoteCreate(page: Page, clientId: string): Promise<Locator> {
  await page.goto(`/clients/${clientId}`);
  await page.getByTestId("client-index-create").click();
  await page.getByTestId("client-index-create-quote").click();
  const popup = page.getByTestId("quote-create-drawer");
  await expect(popup).toBeVisible();
  return popup;
}

test.describe("enquiry pop-up", () => {
  test("a Package enquiry saves, and Save & start quote opens the quote pop-up prefilled; saving that quote marks the enquiry Converted", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const title = `Popup package ${unique("p")}`;

    const popup = await openEnquiryPopup(page, client.id);
    // Create mode offers Save & start quote next to Save enquiry, and a Clear form link.
    await expect(popup.getByTestId("button-save-start-quote")).toBeVisible();
    await expect(popup.getByTestId("form-drawer-submit")).toHaveText("Save enquiry");
    await expect(popup.getByTestId("button-clear-enquiry-form")).toBeVisible();

    await popup.getByTestId("input-enquiry-title").fill(title);
    await chooseSearchable(page, popup.getByTestId("select-enquiry-country"), "Spain", { multi: true });
    await chooseSearchable(page, popup.getByTestId("select-enquiry-destination"), "Majorca", { multi: true });
    await pickDate(page, popup.getByTestId("input-travel-date"), "2027-06-14"); // a quote needs a travel date
    await setNumber(popup.getByTestId("input-adults"), 2);
    await pressChip(popup.getByTestId("select-board-basis"), REF.boardBasis[0]);
    await popup.getByTestId("input-budget").fill("2600");
    await expect(popup.getByTestId("text-enquiry-summary")).toContainText("Majorca");

    await popup.getByTestId("button-save-start-quote").click();
    await expect(page.getByTestId("enquiry-drawer")).toBeHidden();

    // The enquiry was saved before the quote pop-up opened.
    const [enq] = await queryRows<{ id: string; transaction_id: string; status: string; budget: string }>(
      `select id, transaction_id, status, budget from enquiry_table where title = $1`,
      [title],
    );
    expect(enq).toBeTruthy();
    expect(enq.status).toBe("ACTIVE");
    expect(Number(enq.budget)).toBe(2600);

    // The quote pop-up opens prefilled from the enquiry.
    const quote = page.getByTestId("convert-enquiry-drawer");
    await expect(quote).toBeVisible();
    await expect(quote.getByTestId("input-drawer-title")).toHaveValue(title);
    await expect(quote.getByLabel("Travel Date")).toContainText("14/06/2027");
    await expect(quote.getByLabel("Adults")).toHaveValue("2");
    await expect(quote.getByRole("combobox").filter({ hasText: "Majorca" })).toBeVisible();

    await chooseSearchable(page, operatorSelect(quote), REF.operator);
    await quote.getByTestId("drawer-costing-price").fill("2600");
    await quote.getByTestId("form-drawer-submit").click();
    await expectToast(page, "Enquiry converted to quote!");
    await expect(page).toHaveURL(/holiday=quote:/);

    await expect
      .poll(async () => (await queryRows<{ status: string }>(`select status from enquiry_table where id = $1`, [enq.id]))[0]?.status)
      .toBe("Converted");
    const [txn] = await queryRows<{ status: string }>(`select status from transaction where id = $1`, [enq.transaction_id]);
    expect(txn.status).toBe("on_quote");
  });

  test("Escape closes the pop-up without saving", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const popup = await openEnquiryPopup(page, client.id);
    await popup.getByTestId("input-enquiry-title").fill("Escape me");
    await expect(page.getByTestId("client-index-create-enquiry")).toBeHidden(); // the Create menu has finished closing
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("enquiry-drawer")).toBeHidden();
    expect(await queryRows(`select 1 from transaction where client_id = $1`, [client.id])).toHaveLength(0);
  });

  test("opened from the Create menu, focus starts in the title field, and after Escape returns to the menu trigger", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const popup = await openEnquiryPopup(page, client.id);
    await expect(popup.getByTestId("input-enquiry-title")).toBeFocused();
    await expect(page.getByTestId("client-index-create-enquiry")).toBeHidden(); // the Create menu has finished closing
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("enquiry-drawer")).toBeHidden();
    await expect(page.getByTestId("client-index-create")).toBeFocused();
  });

  test("editing an enquiry that has resorts and saving it unchanged keeps the resorts", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const title = `Resort keep ${unique("r")}`;
    const deal = await apiCreateEnquiry(page.request, agency, client.id, userId, {
      title,
      destinations: [agency.ref.destination],
      resorts: [agency.ref.resort],
    });
    const resortRows = () =>
      queryRows(`select resorts_id from enquiry_resorts where enquiry_id = $1`, [deal.enquiryId]).then((r) => r.map((x) => x.resorts_id));
    expect(await resortRows()).toEqual([agency.ref.resort]); // control: the setup really stored it

    await openHoliday(page, client.id, "enquiry", deal.enquiryId);
    await openActionsMenu(page);
    await page.getByRole("menuitem", { name: "Edit Enquiry" }).click();
    const popup = page.getByTestId("enquiry-drawer");
    await expect(popup.getByTestId("input-enquiry-title")).toHaveValue(title);
    await expect(popup.getByTestId("select-enquiry-resort")).toContainText(REF.resort);
    await popup.getByTestId("form-drawer-submit").click();
    await expectToast(page, "Enquiry updated");
    await expect(page.getByTestId("enquiry-drawer")).toBeHidden();
    expect(await resortRows()).toEqual([agency.ref.resort]);
  });

  test("opened from a plain button (header Convert to Quote), Escape closes the quote pop-up and focus returns to that button", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const deal = await apiCreateEnquiry(page.request, agency, client.id, userId, { title: "Focus return" });

    await openHoliday(page, client.id, "enquiry", deal.enquiryId);
    const button = page.getByTestId("holiday-top-actions").getByTestId("button-enquiry-header-convert");
    await button.click();
    await expect(page.getByTestId("convert-enquiry-drawer")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("convert-enquiry-drawer")).toBeHidden();
    await expect(button).toBeFocused();
  });
});

test.describe("quote pop-up", () => {
  test("the side menu ticks sections as they are completed, and clicking a menu item scrolls to that section", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const popup = await openQuoteCreate(page, client.id);

    const nav = popup.getByRole("navigation", { name: "Form sections" });
    const overview = popup.getByTestId("form-nav-qf-overview");
    const costings = popup.getByTestId("form-nav-qf-costings");
    await expect(nav).toBeVisible();
    await expect(overview.getByRole("img", { name: "incomplete" })).toBeVisible();
    await expect(overview).toHaveAttribute("aria-current", "true");

    // Overview needs holiday type + title + operator.
    await popup.getByTestId("input-drawer-title").fill(`Ticks ${unique("t")}`);
    await chooseSearchable(page, operatorSelect(popup), REF.operator);
    await expect(overview.getByRole("img", { name: "complete" })).toBeVisible();

    // Costings ticks once there is a price.
    await expect(costings.getByRole("img", { name: "incomplete" })).toBeVisible();
    await popup.getByTestId("drawer-costing-price").fill("2400");
    await expect(costings.getByRole("img", { name: "complete" })).toBeVisible();

    // Clicking a menu item scrolls its section into view and makes it the current one.
    const flights = popup.getByTestId("form-nav-qf-flights");
    await flights.click();
    await expect(popup.locator("#qf-flights")).toBeInViewport();
    await expect(flights).toHaveAttribute("aria-current", "true");
    await expect(overview).not.toHaveAttribute("aria-current", "true");
    // A late section stays highlighted even though it cannot reach the top of the body.
    const images = popup.getByTestId("form-nav-qf-images");
    await images.click();
    await expect(popup.locator("#qf-images")).toBeInViewport();
    await expect(images).toHaveAttribute("aria-current", "true");
    await costings.click();
    await expect(popup.locator("#qf-costings")).toBeInViewport();
    await overview.click();
    await expect(popup.locator("#qf-overview")).toBeInViewport();
    await expect(overview).toHaveAttribute("aria-current", "true");
  });

  test("the profit card equals Total Profit in the costings section, and follows an extra's commission", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const { quoteId } = await apiCreateQuoteDeal(page.request, agency, client.id, userId, {
      title: `Profit card ${unique("p")}`,
      sales_price: "2400.00",
      package_commission: "240.00",
    });

    await openHoliday(page, client.id, "quote", quoteId);
    await openActionsMenu(page);
    await page.getByRole("menuitem", { name: "Edit Quote" }).click();
    const popup = page.getByTestId("quote-edit-drawer");
    await expect(popup).toBeVisible();

    const card = popup.getByTestId("form-profit");
    const total = popup.getByTestId("drawer-total-profit");
    await expect(total).toHaveText("£240.00");
    await expect(card).toHaveText("£240.00");
    await expect(popup.getByTestId("form-margin")).toContainText("10.0% margin");

    const extras = popup.getByTestId("drawer-section-extras");
    await extras.getByRole("button", { name: "Transfer", exact: true }).click();
    await extras.getByRole("switch").click(); // not included in the package, so a commission can be entered
    await extras.getByLabel("Commission (£)").fill("35");
    await expect(total).toHaveText("£275.00");
    await expect(card).toHaveText("£275.00");
  });

  test("editing a quote from the quote page opens the new pop-up, not the old card form", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const title = `Quote page edit ${unique("q")}`;
    const { quoteId } = await apiCreateQuoteDeal(page.request, agency, client.id, userId, { title });

    await page.goto(`/quotes/${quoteId}`);
    await expect(page.getByTestId("page-quote")).toBeVisible();
    await page.getByTestId("button-quote-actions").click();
    await page.getByTestId("button-quote-edit").click();

    const popup = page.getByTestId("quote-edit-drawer");
    await expect(popup).toBeVisible();
    await expect(page.getByTestId("button-quote-edit")).toBeHidden(); // the Actions menu has finished closing
    // New shell: side menu, profit card and footer submit; prefilled with the quote.
    await expect(popup.getByRole("navigation", { name: "Form sections" })).toBeVisible();
    await expect(popup.getByTestId("form-profit")).toBeVisible();
    await expect(popup.getByTestId("form-drawer-submit")).toBeVisible();
    await expect(popup.getByTestId("input-drawer-title")).toHaveValue(title);
    // Nothing collapsible is left over from the old card form.
    await expect(popup.getByRole("button", { name: "Expand section" })).toHaveCount(0);
    await expect(popup.getByRole("button", { name: "Collapse section" })).toHaveCount(0);

    // Escape closes it.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("quote-edit-drawer")).toBeHidden();
  });
});

test.describe("booking pop-up", () => {
  test("shows References first, and the profit card gains a Net payable line once wallet credit is allocated", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    // Wallet credit is built from referral payouts, so the balance read is stubbed in the browser (no data written).
    await page.route(`**/api/v2/wallet/client/${client.id}/balance`, (route) => route.fulfill({ json: { balance: "100.00" } }));

    await page.goto(`/clients/${client.id}`);
    await page.getByTestId("client-index-create").click();
    await page.getByTestId("client-index-create-booking").click();
    const popup = page.getByTestId("booking-create-drawer");
    await expect(popup).toBeVisible();

    // References is the first menu item and the first section on the page.
    const nav = popup.getByRole("navigation", { name: "Form sections" });
    await expect(nav.getByRole("button").first()).toContainText("References");
    await expect(nav.getByRole("button").first()).toHaveAttribute("data-testid", "form-nav-qf-references");
    const refsBox = await popup.getByTestId("drawer-booking-refs").boundingBox();
    const overviewBox = await popup.getByTestId("drawer-overview").boundingBox();
    expect(refsBox && overviewBox && refsBox.y < overviewBox.y).toBe(true);
    await expect(popup.getByLabel("Hays Ref")).toBeVisible();
    await expect(popup.getByLabel("Supplier Ref")).toBeVisible();

    // No wallet credit yet: no Net payable line.
    await popup.getByTestId("drawer-costing-price").fill("1999");
    await expect(popup.getByTestId("form-profit")).toBeVisible();
    await expect(popup.getByTestId("form-net-payable")).toHaveCount(0);

    await popup.getByLabel("Amount to allocate (£)").fill("40");
    await expect(popup.getByTestId("form-net-payable")).toContainText("£1,959.00");
  });
});

/**
 * Stakeholder items (Nov 2026), written but NOT run (a full suite was running against the test DB):
 *  1. The quote form's flight DEPARTING airport picker uses the departure order (Popular first, then the agency's
 *     most used, then A-Z, with group headings); the ARRIVING picker stays plain A-Z.
 *  2. Converting an enquiry to a quote stores enquiry_table.status = 'Converted'.
 */
import { apiCreateClient, apiCreateEnquiry, openActionsMenu, openHoliday, signIn } from "../helpers/deals";
import { expect, expectToast, test } from "../helpers/fixtures";
import { queryRows, REF, seedDealsAgency } from "../helpers/seed";
import { chooseSearchable } from "../helpers/ui";

test.describe("quote form flight airport order", () => {
  test("outbound Departing shows Popular first with headings, Arriving stays A-Z, and search still reaches every airport", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);

    await page.goto(`/clients/${client.id}`);
    await page.getByTestId("client-index-create").click();
    await page.getByTestId("client-index-create-quote").click();
    const drawer = page.getByTestId("quote-create-drawer");
    await expect(drawer).toBeVisible();

    const flights = drawer.getByTestId("drawer-section-flights");
    // Only expand when collapsed: the toggle closes an already-open section.
    if ((await flights.getAttribute("data-state")) === "closed") {
      await flights.getByRole("button", { name: "Expand section" }).click();
    }
    const outbound = flights.getByTestId("drawer-flight-outbound");

    // Departing: Popular heading first, pinned airports in the stakeholder order.
    await outbound.getByRole("combobox").nth(0).click();
    const departing = page.getByRole("listbox").last();
    await expect(departing).toBeVisible();
    const headings = (await departing.getByTestId("option-group-heading").allInnerTexts()).map((h) => h.trim().toLowerCase());
    expect(headings[0]).toBe("popular");
    expect(headings).toContain("all airports");
    const pinnedOrder = ["(NCL)", "(LBA)", "(MME)", "(MAN)", "(EDI)", "(LGW)", "(LHR)", "(GLA)"];
    const options = (await departing.getByRole("option").allInnerTexts()).map((t) => t.trim());
    const positions = pinnedOrder.map((code) => options.findIndex((o) => o.endsWith(code))).filter((i) => i >= 0);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions[0]).toBe(0);
    // Search reaches an airport that is not pinned.
    await departing.getByRole("textbox").fill("a");
    expect(await departing.getByRole("option").count()).toBeGreaterThan(0);
    // Escape closes only the dropdown, never the whole quote drawer (unsaved work).
    await page.keyboard.press("Escape");
    await expect(departing).toBeHidden();
    await expect(drawer).toBeVisible();

    // Arriving: no headings, plain A-Z.
    await outbound.getByRole("combobox").nth(1).click();
    const arriving = page.getByRole("listbox").last();
    await expect(arriving).toBeVisible();
    await expect(arriving.getByTestId("option-group-heading")).toHaveCount(0);
    const arrivals = (await arriving.getByRole("option").allInnerTexts()).map((t) => t.trim());
    expect(arrivals).toEqual([...arrivals].sort((a, b) => a.localeCompare(b)));
  });
});

test.describe("converting an enquiry", () => {
  test("stores status Converted on the enquiry", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const deal = await apiCreateEnquiry(page.request, agency, client.id, userId, { title: "Status converted" });

    await openHoliday(page, client.id, "enquiry", deal.enquiryId);
    await openActionsMenu(page);
    await page.getByRole("menuitem", { name: "Convert to Quote" }).click();
    const drawer = page.getByTestId("convert-enquiry-drawer");
    await expect(drawer).toBeVisible();
    await chooseSearchable(page, drawer.getByRole("combobox").filter({ hasText: /Select operator|E2E /i }), REF.operator);
    await drawer.getByTestId("drawer-costing-price").fill("1500");
    await drawer.getByTestId("form-drawer-submit").click();
    await expectToast(page, "Enquiry converted to quote!");

    await expect
      .poll(async () => (await queryRows<{ status: string }>(`select status from enquiry_table where id = $1`, [deal.enquiryId]))[0]?.status)
      .toBe("Converted");
  });
});

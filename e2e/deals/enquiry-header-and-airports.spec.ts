/**
 * Stakeholder items (Nov 2026), written but NOT run (test database on localhost:55432 was down):
 *  1. Departure airports are ordered: pinned (NCL, LBA, MME, MAN, EDI, LGW, LHR, GLA), then the agency's most-used, then A-Z.
 *  2. The enquiry header has an orange "Convert to Quote" button that opens the same convert drawer, and is hidden once
 *     the enquiry is converted or lost.
 */
import type { Page } from "@playwright/test";
import { apiCreateClient, apiCreateEnquiry, openHoliday, signIn } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { queryRows, seedDealsAgency } from "../helpers/seed";

const EXTRA_AIRPORTS = [
  { name: "Manchester", code: "MAN" },
  { name: "London Heathrow", code: "LHR" },
  { name: "Bristol", code: "BRS" },
  { name: "Aberdeen", code: "ABZ" },
  { name: "Zeta Field", code: "ZZF" },
];

/** Adds extra UK airports to the (test) database, once, and returns their ids by code. */
async function seedUkAirports(): Promise<Record<string, string>> {
  const [uk] = await queryRows<{ id: string }>(`select id from country_table where country_code = 'GB' limit 1`);
  for (const a of EXTRA_AIRPORTS) {
    await queryRows(
      `insert into airport_table (airport_name, airport_code, country_id)
       select $1::varchar, $2::varchar, $3::uuid where not exists (select 1 from airport_table where airport_code = $2::varchar)`,
      [a.name, a.code, uk.id],
    );
  }
  const rows = await queryRows<{ id: string; airport_code: string }>(
    `select id, airport_code from airport_table where airport_code = any($1)`,
    [EXTRA_AIRPORTS.map((a) => a.code)],
  );
  return Object.fromEntries(rows.map((r) => [r.airport_code, r.id]));
}

async function openEnquiryDrawer(page: Page, clientId: string) {
  await page.goto(`/clients/${clientId}`);
  await page.getByTestId("client-index-create").click();
  await page.getByTestId("client-index-create-enquiry").click();
  const drawer = page.getByTestId("enquiry-drawer");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByTestId("select-holiday-type")).toContainText("Package Holiday");
  return drawer;
}

test.describe("enquiry departure airport order", () => {
  test("pinned first in the stakeholder order, then the agency's most used, then everything else A-Z, with headings", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const ids = await seedUkAirports();
    const client = await apiCreateClient(page.request);
    // Bristol used twice, Aberdeen once; Manchester (pinned) must not appear among the most used.
    await apiCreateEnquiry(page.request, agency, client.id, userId, { departureAirports: [ids.BRS, ids.MAN] });
    await apiCreateEnquiry(page.request, agency, client.id, userId, { departureAirports: [ids.BRS, ids.ABZ] });

    const drawer = await openEnquiryDrawer(page, client.id);
    await drawer.getByTestId("input-departure-airport").click();
    const listbox = page.getByRole("listbox").last();
    await expect(listbox).toBeVisible();

    const options = (await listbox.getByRole("option").allInnerTexts()).map((t) => t.trim());
    // Only NCL, MAN and LHR exist among the pinned codes in the test data, in pinned order.
    expect(options.slice(0, 3)).toEqual(["Newcastle International (NCL)", "Manchester (MAN)", "London Heathrow (LHR)"]);
    expect(options.slice(3, 5)).toEqual(["Bristol (BRS)", "Aberdeen (ABZ)"]);
    const rest = options.slice(5);
    expect([...rest].sort((a, b) => a.localeCompare(b))).toEqual(rest);

    const headings = await listbox.getByTestId("option-group-heading").allInnerTexts();
    expect(headings.map((h) => h.trim().toLowerCase())).toEqual(["popular", "most used by your agency", "all airports"]);

    // Search still reaches every airport.
    await listbox.getByRole("textbox").fill("Zeta");
    await expect(listbox.getByRole("option")).toHaveCount(1);
    await expect(listbox.getByRole("option").first()).toContainText("Zeta Field");
  });
});

test.describe("enquiry header Convert to Quote button", () => {
  test("is visible and orange, opens the convert drawer, and is hidden once lost (a converted enquiry leaves the client page as the deal moves to quote)", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const deal = await apiCreateEnquiry(page.request, agency, client.id, userId, { title: "Header convert" });

    await openHoliday(page, client.id, "enquiry", deal.enquiryId);
    const button = page.getByTestId("holiday-top-actions").getByTestId("button-enquiry-header-convert");
    await expect(button).toBeVisible();
    await expect(button).toHaveText("Convert to Quote");
    await expect(button).toHaveClass(/bg-social-orange/);
    await button.click();
    const drawer = page.getByTestId("convert-enquiry-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId("input-drawer-title")).toHaveValue("Header convert");
    await page.keyboard.press("Escape");

    for (const status of ["LOST"]) {
      await queryRows(`update enquiry_table set status = $1 where id = $2`, [status, deal.enquiryId]);
      await openHoliday(page, client.id, "enquiry", deal.enquiryId);
      await expect(page.getByTestId("holiday-top-actions").getByTestId("client-header-actions")).toBeVisible();
      await expect(page.getByTestId("button-enquiry-header-convert")).toHaveCount(0);
    }
  });
});

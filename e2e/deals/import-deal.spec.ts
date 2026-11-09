import type { Locator, Page } from "@playwright/test";
import { apiCreateClient, signIn } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { seedDealsAgency } from "../helpers/seed";

// A scraped deal: the outbound lands at 17:30, so check-in must be 18:30 whatever
// check-in time the supplier page states (12:00 here).
const DEAL = {
  quote_title: "Imported Sunny Break",
  travel_date: "2027-05-12",
  sales_price: "2400",
  no_of_nights: 7,
  hotels: [{ check_in_date_time: "2027-05-12T12:00" }],
  flights: [
    {
      flight_number: "BY1",
      flight_type: "outbound",
      departing_airport: "MAN",
      departing_airport_name: "",
      departure_date_time: "2027-05-12T09:00",
      arrival_airport: "PMI",
      arrival_airport_name: "",
      arrival_date_time: "2027-05-12T17:30",
    },
  ],
};

const EMPTY_MAPPING = {
  countryId: "", destinationId: "", resortId: "", accommodationId: "", boardBasisId: "", tourOperatorId: "",
  outboundDepartAirportId: "", outboundArriveAirportId: "", inboundDepartAirportId: "", inboundArriveAirportId: "",
  roomTypeId: "", isLodge: false, lodgeId: "", parkId: "", cruiseLineId: "", shipId: "", cruiseItineraryId: "",
  extraAccommodations: [], transfers: [], carHires: [], attractionTickets: [], loungePasses: [], airportParkings: [],
  warnings: [],
};

/** Fakes the bookmarklet clipboard and the two server calls Import Deal makes (no scraping, no lookups written). */
async function fakeCapture(page: Page): Promise<void> {
  await page.addInitScript((text) => {
    Object.defineProperty(navigator, "clipboard", { value: { readText: async () => text }, configurable: true });
  }, JSON.stringify({ url: "https://supplier.example/deal/1", text: "captured page text" }));
  await page.route("**/api/v2/scrapers/import-page", (route) =>
    route.fulfill({ json: { success: true, message: "", data: DEAL } }));
  await page.route("**/api/v2/json-mapper/map-to-ids", (route) =>
    route.fulfill({ json: { success: true, data: EMPTY_MAPPING } }));
}

async function openDrawer(page: Page, kind: "quote" | "booking"): Promise<Locator> {
  const client = await apiCreateClient(page.request);
  await page.goto(`/clients/${client.id}`);
  await page.getByTestId("client-index-create").click();
  await page.getByTestId(`client-index-create-${kind}`).click();
  const drawer = page.getByTestId(`${kind}-create-drawer`);
  await expect(drawer).toBeVisible();
  return drawer;
}

test.describe("Import Deal on the quote and booking forms", () => {
  test("the quote form has Import Deal and no raw Import JSON", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const drawer = await openDrawer(page, "quote");
    await expect(drawer.getByTestId("button-import-deal")).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Import Deal" })).toBeVisible();
    await expect(drawer.getByTestId("quote-import-bar")).toHaveCount(0); // the paste bar only opens when the clipboard fails
    await expect(drawer.getByText("Import JSON")).toHaveCount(0);
    await expect(drawer.locator('input[type="file"][accept*="json"]')).toHaveCount(0);
  });

  test("the booking form has Import Deal, no raw Import JSON, and importing fills the booking with the check-in rule applied", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    await fakeCapture(page);
    const drawer = await openDrawer(page, "booking");
    await expect(drawer.getByText("Import JSON")).toHaveCount(0);
    await drawer.getByRole("button", { name: "Import Deal" }).click();
    await expect(drawer.getByTestId("input-drawer-title")).toHaveValue("Imported Sunny Break");
    await expect(drawer.getByTestId("drawer-costing-price")).toHaveValue("2400");
    await expect(drawer.getByLabel("Check-in Time")).toHaveValue("18:30");
  });

  test("a normal quote import sets check-in from the landing time, and a hand-typed time survives a later arrival edit", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    await fakeCapture(page);
    const drawer = await openDrawer(page, "quote");
    await drawer.getByRole("button", { name: "Import Deal" }).click();
    await expect(drawer.getByTestId("input-drawer-title")).toHaveValue("Imported Sunny Break");
    const checkIn = drawer.getByLabel("Check-in Time");
    await expect(checkIn).toHaveValue("18:30");
    await checkIn.fill("20:15");
    await expect(checkIn).toHaveValue("20:15");
  });
});

test.describe("Import Deal inline paste bar (clipboard unavailable)", () => {
  test("when the clipboard cannot be read, the head button opens the paste bar and a pasted capture imports the deal", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    // Same server fakes as fakeCapture, but the clipboard read is refused.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { value: { readText: async () => { throw new Error("denied"); } }, configurable: true });
    });
    await page.route("**/api/v2/scrapers/import-page", (route) => route.fulfill({ json: { success: true, message: "", data: DEAL } }));
    await page.route("**/api/v2/json-mapper/map-to-ids", (route) => route.fulfill({ json: { success: true, data: EMPTY_MAPPING } }));
    const drawer = await openDrawer(page, "quote");

    await drawer.getByTestId("button-import-deal").click();
    const bar = drawer.getByTestId("quote-import-bar");
    await expect(bar).toBeVisible();
    await expect(bar.getByLabel("Supplier", { exact: true })).toBeVisible();

    // Junk is refused with a message and the bar stays open.
    await bar.locator("#qf-import-paste").fill("not a capture");
    await bar.getByRole("button", { name: "Import", exact: true }).click();
    await expect(bar.getByRole("alert")).toBeVisible();
    await expect(drawer.getByTestId("input-drawer-title")).not.toHaveValue("Imported Sunny Break");

    await bar.locator("#qf-import-paste").fill(JSON.stringify({ url: "https://supplier.example/deal/1", text: "captured page text" }));
    await bar.getByRole("button", { name: "Import", exact: true }).click();
    await expect(drawer.getByTestId("input-drawer-title")).toHaveValue("Imported Sunny Break");
    await expect(drawer.getByTestId("drawer-costing-price")).toHaveValue("2400");
    await expect(bar).toBeHidden();
  });
});

test.describe("Import Deal validation panel (errors only)", () => {
  const warn = { level: "warn", code: "NIGHTS_SOURCE_CONFLICT", message: "Nights disagree", field: "no_of_nights" };
  const err = { level: "error", code: "PRICE_ZERO", message: "Price missing", field: "sales_price" };

  async function importWith(page: Page, issues: Array<{ level: string }>): Promise<Locator> {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    await fakeCapture(page);
    // Registered after fakeCapture, so this route wins: the response now carries a validation block.
    await page.route("**/api/v2/scrapers/import-page", (route) =>
      route.fulfill({
        json: {
          success: true,
          message: "",
          data: { ...DEAL, validation: { level: issues.some((i) => i.level === "error") ? "error" : "warn", issues } },
        },
      }));
    const drawer = await openDrawer(page, "quote");
    await drawer.getByRole("button", { name: "Import Deal" }).click();
    await expect(drawer.getByTestId("input-drawer-title")).toHaveValue("Imported Sunny Break");
    return drawer;
  }

  test("warnings only: no 'Check this import before saving' panel", async ({ page }) => {
    const drawer = await importWith(page, [warn]);
    await expect(drawer.getByTestId("import-validation-panel")).toHaveCount(0);
    await expect(drawer.getByText("Check this import before saving")).toHaveCount(0);
  });

  test("an error shows the panel with the error and none of the warnings", async ({ page }) => {
    const drawer = await importWith(page, [warn, err]);
    const panel = drawer.getByTestId("import-validation-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Sales price");
    await expect(panel).not.toContainText("Nights");
  });
});

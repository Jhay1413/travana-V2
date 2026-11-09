import type { Locator, Page } from "@playwright/test";
import { openActionsMenu, openHoliday } from "../helpers/deals";
import { expect, expectToast, test } from "../helpers/fixtures";
import { boardWorld, cardIn, openBoard, quoteDeal, type BoardWorld, type Deal } from "../helpers/pipeline";
import { queryRows } from "../helpers/seed";

/**
 * Extras on a quote.
 *  - what the customer pays: a NOT-included extra adds its cost to the Final total and to the saved deal's value;
 *    an included one adds nothing
 *  - dates: a new extra picks up the quote's travel and return dates
 *  - the client page "The Trip" tab shows one of each extra type
 */

const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

async function openEditDrawer(page: Page, w: BoardWorld, deal: Deal): Promise<Locator> {
  await openHoliday(page, w.clientId, "quote", deal.entityId);
  await openActionsMenu(page);
  await page.getByRole("menuitem", { name: "Edit Quote" }).click();
  const drawer = page.getByTestId("quote-edit-drawer");
  await expect(drawer).toBeVisible();
  return drawer;
}

async function openExtras(drawer: Locator): Promise<Locator> {
  const extras = drawer.getByTestId("drawer-section-extras");
  // Extras are always open in the redesigned pop-up (no Expand/Collapse toggle).
  await expect(extras).toBeVisible();
  await expect(extras.getByRole("button", { name: "Expand section" })).toHaveCount(0);
  return extras;
}

test.describe("extras and the customer total", () => {
  test("a not-included extra with a cost raises the Final total and the saved deal's value; turning Included on takes it off again", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await quoteDeal(page.request, w, { sales_price: "2400.00", package_commission: "240.00", travel_date: "2027-06-14" });

    const drawer = await openEditDrawer(page, w, deal);
    const summary = drawer.getByTestId("drawer-costing-summary");
    await expect(summary).toContainText("Final total £2400.00");

    const extras = await openExtras(drawer);
    await extras.getByRole("button", { name: "Transfer", exact: true }).click();
    // New extras start as "Included in package": a cost typed there adds nothing to the total.
    await extras.getByRole("switch").click();
    await extras.getByLabel("Cost (£)").fill("100");
    await expect(summary).toContainText("Final total £2500.00");

    // Switching Included back on takes it off the total but KEEPS the typed cost.
    await extras.getByRole("switch").click();
    await expect(summary).toContainText("Final total £2400.00");
    await expect(extras.getByLabel("Cost (£)")).toHaveValue("100");

    // Back to not included: the cost is still there and the total includes it again; then save.
    await extras.getByRole("switch").click();
    await expect(extras.getByLabel("Cost (£)")).toHaveValue("100");
    await expect(summary).toContainText("Final total £2500.00");
    await drawer.getByTestId("form-drawer-submit").click();
    await expectToast(page, "Quote updated");

    // sales_price is untouched; the extra is saved as not included.
    const [saved] = await queryRows<{ sales_price: string; cost: string; inc: boolean | null }>(
      `select q.sales_price, t.cost, t.is_included_in_package as inc from quote_table q join quote_transfers t on t.quote_id = q.id where q.id = $1`,
      [deal.entityId],
    );
    expect(Number(saved.sales_price)).toBe(2400);
    expect(Number(saved.cost)).toBe(100);
    expect(saved.inc).toBe(false);

    // The detail page's Costings tab and the pipeline card carry the same total.
    await openHoliday(page, w.clientId, "quote", deal.entityId);
    await page.getByTestId("holiday-trip-costings-tab-costings").click();
    await expect(page.getByTestId("holiday-money-card")).toContainText("£2,500.00");
    // The price block at the top carries the extra too: total and per person (2 adults).
    await expect(page.getByTestId("holiday-hero")).toContainText("£2,500.00");
    await expect(page.getByTestId("holiday-hero-per-person")).toContainText("£1,250.00 per person");
    await openBoard(page);
    await expect(cardIn(page, "Quoted", deal.transactionId)).toContainText(`Cost ${gbp(2500)}`);
    // Package £240 + the extra's auto commission (operator 10% of £100 = £10).
    await expect(cardIn(page, "Quoted", deal.transactionId)).toContainText("Profit £250");
  });

  test("an extra left as Included in package does not change the Final total or the saved deal's value", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await quoteDeal(page.request, w, { sales_price: "2400.00", package_commission: "240.00", travel_date: "2027-06-14" });

    const drawer = await openEditDrawer(page, w, deal);
    const summary = drawer.getByTestId("drawer-costing-summary");
    const extras = await openExtras(drawer);
    await extras.getByRole("button", { name: "Car Hire", exact: true }).click();
    await expect(extras.getByRole("switch")).toBeChecked();
    await expect(summary).toContainText("Final total £2400.00");
    await drawer.getByTestId("form-drawer-submit").click();
    await expectToast(page, "Quote updated");

    await openBoard(page);
    await expect(cardIn(page, "Quoted", deal.transactionId)).toContainText(`Cost ${gbp(2400)}`);
  });
});

test.describe("extras cost behaviour", () => {
  test("typing a cost updates the Final total live, a hint explains an included extra adds nothing, and the cost survives a save", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await quoteDeal(page.request, w, { sales_price: "2400.00", package_commission: "240.00", travel_date: "2027-06-14" });

    const drawer = await openEditDrawer(page, w, deal);
    const summary = drawer.getByTestId("drawer-costing-summary");
    const extras = await openExtras(drawer);
    await extras.getByRole("button", { name: "Car Hire", exact: true }).click();

    // Included (the default): the cost is accepted but explained, and the total does not move.
    await extras.getByLabel("Cost (£)").fill("75");
    await expect(extras.getByTestId("extra-cost-included-hint")).toBeVisible();
    await expect(summary).toContainText("Final total £2400.00");

    // Not included: the total moves on every change, character by character.
    await extras.getByRole("switch").click();
    await expect(extras.getByTestId("extra-cost-included-hint")).toHaveCount(0);
    await expect(summary).toContainText("Final total £2475.00");
    await extras.getByLabel("Cost (£)").fill("120.50");
    await expect(summary).toContainText("Final total £2520.50");

    await drawer.getByTestId("form-drawer-submit").click();
    await expectToast(page, "Quote updated");
    const [saved] = await queryRows<{ cost: string; inc: boolean | null }>(
      `select c.cost, c.is_included_in_package as inc from quote_car_hire c where c.quote_id = $1`,
      [deal.entityId],
    );
    expect(Number(saved.cost)).toBe(120.5);
    expect(saved.inc).toBe(false);

    // Re-opening the form shows the saved cost and the same total.
    const reopened = await openEditDrawer(page, w, deal);
    const reopenedExtras = await openExtras(reopened);
    await expect(reopenedExtras.getByLabel("Cost (£)")).toHaveValue("120.5");
    await expect(reopened.getByTestId("drawer-costing-summary")).toContainText("Final total £2520.50");
  });
});

test.describe("extras commission and per person", () => {
  test("a not-included extra shows its commission on the card, a hand-typed commission sticks, and an included extra shows none", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await quoteDeal(page.request, w, { sales_price: "2400.00", package_commission: "240.00", travel_date: "2027-06-14", adult: 2, child: 0 });

    const drawer = await openEditDrawer(page, w, deal);
    const extras = await openExtras(drawer);
    await extras.getByRole("button", { name: "Transfer", exact: true }).click();

    // Included (default): no commission of its own.
    await expect(extras.getByTestId("extra-commission-summary")).toContainText("Included in package");

    // Not included: the commission is calculated from the cost and shown on the card.
    await extras.getByRole("switch").click();
    await extras.getByLabel("Cost (£)").fill("200");
    await expect(extras.getByTestId("extra-commission-summary")).toContainText(/Commission £\d+\.\d{2}/);

    // A hand-typed commission is kept when the cost changes afterwards.
    await extras.getByTestId("extra-commission-input").fill("7");
    await extras.getByLabel("Cost (£)").fill("300");
    await expect(extras.getByTestId("extra-commission-input")).toHaveValue("7");
    await expect(extras.getByTestId("extra-commission-summary")).toContainText("Commission £7.00");

    // Total Profit = package commission + the extra commission.
    await expect(drawer.getByTestId("drawer-total-profit")).toContainText("£247.00");

    // Per person includes the extra: (2400 + 300) / 2.
    await expect(drawer.getByTestId("drawer-costing-summary")).toContainText("Per person £1350.00");
  });
});

test.describe("extras dates", () => {
  test("new extras pick up the travel date, and the return date (travel date + nights) for drop-offs", async ({ page }) => {
    const w = await boardWorld(page);
    const deal = await quoteDeal(page.request, w, { travel_date: "2027-06-14", num_of_nights: 7 });

    const drawer = await openEditDrawer(page, w, deal);
    const extras = await openExtras(drawer);
    for (const name of ["Transfer", "Car Hire", "Attraction Ticket", "Lounge Pass", "Airport Parking", "Extra Accommodation"]) {
      await extras.getByRole("button", { name, exact: true }).click();
    }

    const pickUps = extras.getByLabel("Pick-up Date"); // transfer, then car hire
    const dropOffs = extras.getByLabel("Drop-off Date");
    await expect(pickUps.nth(0)).toContainText("14/06/2027");
    await expect(pickUps.nth(1)).toContainText("14/06/2027");
    await expect(dropOffs.nth(0)).toContainText("21/06/2027");
    await expect(dropOffs.nth(1)).toContainText("21/06/2027");
    await expect(extras.getByLabel("Date of Visit")).toContainText("14/06/2027");
    await expect(extras.getByLabel("Date of Usage")).toContainText("14/06/2027");
    await expect(extras.getByLabel("Parking Date")).toContainText("14/06/2027");
    await expect(extras.getByLabel("Check-in Date")).toContainText("14/06/2027");
  });
});

test.describe("extras on the client page Trip tab", () => {
  test("a quote with one of each extra type shows all six on The Trip tab", async ({ page }) => {
    const w = await boardWorld(page);
    const r = w.agency.ref;
    const deal = await quoteDeal(page.request, w, {
      title: "Every extra",
      travel_date: "2027-06-14",
      num_of_nights: 10,
      extra: {
        primaryAccommodation: { accomodation_id: r.accommodation, board_basis_id: r.boardBasis, room_type: "Double", no_of_nights: 10, check_in_date_time: "2027-06-14T15:00:00" },
        transfers: [{ tour_operator_id: r.operator, pick_up_location: "Palma airport", drop_off_location: "Hotel Playa Azul", pick_up_time: "2027-06-14T12:30:00", drop_off_time: "2027-06-14T13:30:00", cost: "40.00", commission: "4.00", is_included_in_package: false }],
        carHires: [{ tour_operator_id: r.operator, pick_up_location: "Car depot pick", drop_off_location: "Car depot drop", pick_up_time: "2027-06-15T09:00:00", drop_off_time: "2027-06-18T09:00:00", no_of_days: 3, driver_age: 35, cost: "150.00", commission: "15.00", is_included_in_package: false }],
        attractionTickets: [{ tour_operator_id: r.operator, ticket_type: "Water park", date_of_visit: "2027-06-16T00:00:00", number_of_tickets: 4, cost: "120.00", commission: "12.00", is_included_in_package: false }],
        loungePasses: [{ airport_id: r.airport, terminal: "2", date_of_usage: "2027-06-14T00:00:00", tour_operator_id: r.operator, cost: "25.00", commission: "2.50", is_included_in_package: false }],
        airportParkings: [{ tour_operator_id: r.operator, airport_id: r.airport, parking_type: "Meet and greet", parking_date: "2027-06-14T00:00:00", duration: "10 days", cost: "95.00", commission: "9.50", is_included_in_package: false }],
        extraAccommodations: [{ tour_operator_id: r.operator, accomodation_id: r.accommodation, board_basis_id: r.boardBasis2, room_type: "Twin", check_in_date_time: "2027-06-24T00:00:00", no_of_nights: 2, cost: "180.00", commission: "18.00", is_included_in_package: false }],
      },
    });

    await openHoliday(page, w.clientId, "quote", deal.entityId);
    await page.getByTestId("holiday-trip-costings-tab-trip").click();
    const trip = page.getByTestId("holiday-trip-card");
    await expect(trip.getByTestId("trip-stop-extra-transfer")).toHaveCount(1);
    await expect(trip.getByTestId("trip-stop-extra-transfer")).toContainText("Palma airport");
    await expect(trip.getByTestId("trip-stop-extra-carhire")).toHaveCount(1);
    await expect(trip.getByTestId("trip-stop-extra-carhire")).toContainText("Car depot pick");
    await expect(trip.getByTestId("trip-stop-extra-ticket")).toHaveCount(1);
    await expect(trip.getByTestId("trip-stop-extra-ticket")).toContainText("Water park");
    await expect(trip.getByTestId("trip-stop-extra-lounge")).toHaveCount(1);
    await expect(trip.getByTestId("trip-stop-extra-lounge")).toContainText("Terminal 2");
    await expect(trip.getByTestId("trip-stop-extra-parking")).toHaveCount(1);
    await expect(trip.getByTestId("trip-stop-extra-parking")).toContainText("Meet and greet");
    // Extra accommodation sits in the itinerary as a second hotel check-in.
    await expect(trip.getByTestId("trip-stop-hotel-extra")).toHaveCount(1);
  });
});

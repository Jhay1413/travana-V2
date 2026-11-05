import type { Locator, Page } from "@playwright/test";
import { HAYS_REF_MESSAGE } from "../../shared/booking-refs";
import {
  apiCreateClient,
  apiCreateQuoteDeal,
  dbBookingFor,
  dbQuote,
  dbTransaction,
  quotePayload,
  signIn,
  dataOf,
} from "../helpers/deals";
import { expect, expectToast, test } from "../helpers/fixtures";
import {
  queryRows,
  seedDealsAgency,
  seedLegacyBooking,
  seedQuoteTask,
  taskCompleted,
  unique,
  type DealsAgency,
} from "../helpers/seed";
import { chooseOption, pickDate } from "../helpers/ui";

const SUPPLIER_REF = "TUI 78451236";

/** A signed-in agent with a client and one quote (the deal to be booked). */
async function agentWithQuote(page: Page, extra: Parameters<typeof quotePayload>[1] = {}) {
  const agency = await seedDealsAgency();
  const userId = await signIn(page, agency.agentEmail);
  const client = await apiCreateClient(page.request);
  const title = `Trip ${unique("b")}`;
  const deal = await apiCreateQuoteDeal(page.request, agency, client.id, userId, { title, ...extra });
  return { agency, userId, client, title, ...deal };
}

async function openQuotePage(page: Page, clientId: string, quoteId: string): Promise<void> {
  await page.goto(`/clients/${clientId}?holiday=quote:${quoteId}`);
  await expect(page.getByTestId("holiday-top-bar")).toBeVisible();
}

/* ------------------------------ three dialogs ------------------------------ */

interface ConvertDialogDriver {
  name: string;
  /** Opens the dialog for this quote. */
  open(page: Page, ctx: { clientId: string; quoteId: string; transactionId: string; title: string }): Promise<Locator>;
  fill(dialog: Locator, hays: string, supplier: string): Promise<void>;
  submit(dialog: Locator): Promise<void>;
  hysError(dialog: Locator): Locator;
  supplierError(dialog: Locator): Locator;
}

const clientHolidayDialog: ConvertDialogDriver = {
  name: "client holiday page",
  async open(page, { clientId, quoteId }) {
    await openQuotePage(page, clientId, quoteId);
    await page.getByTestId("holiday-top-convert").click();
    const dialog = page.getByTestId("dialog-convert-booking");
    await expect(dialog).toBeVisible();
    return dialog;
  },
  async fill(dialog, hays, supplier) {
    await dialog.getByLabel("HAYS Ref").fill(hays);
    await dialog.getByLabel(/^Supplier Ref/).fill(supplier);
  },
  submit: (dialog) => dialog.getByRole("button", { name: "Confirm booking" }).click(),
  hysError: (dialog) => dialog.locator("#convert-hays-err"),
  supplierError: (dialog) => dialog.locator("#convert-supplier-err"),
};

// The drawer no longer moves deals: its main button opens the full deal page, where the same convert dialog lives.
const pipelineDialog: ConvertDialogDriver = {
  ...clientHolidayDialog,
  name: "pipeline drawer to full deal page",
  async open(page, { transactionId }) {
    await page.goto("/pipeline");
    await page.getByTestId(`pipeline-card-${transactionId}`).click();
    await expect(page.getByTestId("transaction-detail-panel")).toBeVisible();
    await expect(page.getByTestId("button-drawer-primary")).toHaveText("Open full deal");
    await page.getByTestId("button-drawer-primary").click();
    await expect(page.getByTestId("holiday-top-bar")).toBeVisible();
    await page.getByTestId("holiday-top-convert").click();
    const dialog = page.getByTestId("dialog-convert-booking");
    await expect(dialog).toBeVisible();
    return dialog;
  },
};

const olderQuotePageDialog: ConvertDialogDriver = {
  name: "older quote page",
  async open(page, { quoteId }) {
    await page.goto(`/quotes/${quoteId}`);
    await page.getByTestId("button-quote-actions").click();
    await page.getByTestId("button-quote-convert").click();
    const dialog = page.getByTestId("dialog-convert-booking");
    await expect(dialog).toBeVisible();
    return dialog;
  },
  async fill(dialog, hays, supplier) {
    await dialog.getByTestId("input-convert-hays-ref").fill(hays);
    await dialog.getByTestId("input-convert-tour-ref").fill(supplier);
  },
  submit: (dialog) => dialog.getByTestId("button-confirm-convert").click(),
  hysError: (dialog) => dialog.getByTestId("error-convert-hays-ref"),
  supplierError: (dialog) => dialog.getByTestId("error-convert-tour-ref"),
};

const DIALOGS = [clientHolidayDialog, pipelineDialog, olderQuotePageDialog];

async function expectNothingSaved(transactionId: string, quoteId: string): Promise<void> {
  expect(await dbBookingFor(transactionId)).toBeUndefined();
  expect((await dbTransaction(transactionId)).status).toBe("on_quote");
  expect((await dbQuote(quoteId)).deleted_at).toBeNull();
}

test.describe("quote to booking, from each of the three dialogs", () => {
  for (const dialogDriver of DIALOGS) {
    test(`${dialogDriver.name}: a good HAYS Ref and Supplier Ref book the quote, move the deal to booked and finish the quote's tasks`, async ({ page }) => {
      const d = await agentWithQuote(page);
      const taskId = await seedQuoteTask({ userId: d.userId, orgId: d.agency.orgId, branchId: d.agency.branchId, quoteId: d.quoteId });

      const dialog = await dialogDriver.open(page, { clientId: d.client.id, quoteId: d.quoteId, transactionId: d.transactionId, title: "" });
      await dialogDriver.fill(dialog, "HAY-1234567", SUPPLIER_REF);
      await dialogDriver.submit(dialog);
      await expect(dialog).toBeHidden();

      const booking = await dbBookingFor(d.transactionId);
      expect(booking).toMatchObject({ hays_ref: "HAY-1234567", supplier_ref: SUPPLIER_REF, quote_id: d.quoteId, booking_status: "BOOKED" });
      expect((await dbTransaction(d.transactionId)).status).toBe("on_booking");
      expect(await taskCompleted(taskId)).toBe(true);
    });

    test(`${dialogDriver.name}: a bad HAYS Ref (6 digits, 9 digits, wrong prefix or blank) is refused inline and nothing is saved`, async ({ page }) => {
      const d = await agentWithQuote(page);
      const dialog = await dialogDriver.open(page, { clientId: d.client.id, quoteId: d.quoteId, transactionId: d.transactionId, title: "" });

      const cases: Array<{ input: string; message: string }> = [
        { input: "HAY-123456", message: HAYS_REF_MESSAGE },
        { input: "HAY-123456789", message: HAYS_REF_MESSAGE },
        { input: "ABC-1234567", message: HAYS_REF_MESSAGE },
        { input: "1234567", message: HAYS_REF_MESSAGE },
        { input: "", message: "Enter the HAYS reference." },
        { input: "   ", message: "Enter the HAYS reference." },
      ];
      for (const c of cases) {
        await dialogDriver.fill(dialog, c.input, SUPPLIER_REF);
        await dialogDriver.submit(dialog);
        await expect(dialogDriver.hysError(dialog), JSON.stringify(c.input)).toHaveText(c.message);
        await expect(dialog).toBeVisible();
      }
      await expectNothingSaved(d.transactionId, d.quoteId);
    });

    test(`${dialogDriver.name}: a blank Supplier Ref is refused inline and nothing is saved`, async ({ page }) => {
      const d = await agentWithQuote(page);
      const dialog = await dialogDriver.open(page, { clientId: d.client.id, quoteId: d.quoteId, transactionId: d.transactionId, title: "" });
      await dialogDriver.fill(dialog, "HAY-1234567", "   ");
      await dialogDriver.submit(dialog);
      await expect(dialogDriver.supplierError(dialog)).toHaveText("Enter the supplier reference.");
      await expect(dialogDriver.hysError(dialog)).toHaveCount(0);
      await expect(dialog).toBeVisible();
      await expectNothingSaved(d.transactionId, d.quoteId);
    });
  }
});

test.describe("HAYS Ref normalising and length", () => {
  const ACCEPTED: Array<{ typed: string; saved: string }> = [
    { typed: "hay-1234567", saved: "HAY-1234567" }, // lower case
    { typed: "hay1234567", saved: "HAY-1234567" }, // no hyphen
    { typed: "  HAY 1234567  ", saved: "HAY-1234567" }, // spaces
    { typed: "HAY-12345678", saved: "HAY-12345678" }, // 8 digits
    { typed: "hay12345678", saved: "HAY-12345678" }, // 8 digits, lower case, no hyphen
    { typed: "HAY-1234567", saved: "HAY-1234567" }, // 7 digits
  ];

  test("each forgiving spelling is saved as HAY- plus the digits; 7 and 8 digits are both accepted", async ({ page }) => {
    for (const c of ACCEPTED) {
      const d = await agentWithQuote(page);
      const dialog = await clientHolidayDialog.open(page, { clientId: d.client.id, quoteId: d.quoteId, transactionId: d.transactionId, title: "" });
      await clientHolidayDialog.fill(dialog, c.typed, SUPPLIER_REF);
      await clientHolidayDialog.submit(dialog);
      await expect(dialog, c.typed).toBeHidden();
      expect((await dbBookingFor(d.transactionId)).hays_ref, c.typed).toBe(c.saved);
    }
  });

  test("the pipeline dialog and the older quote dialog normalise the same way", async ({ page }) => {
    for (const driver of [pipelineDialog, olderQuotePageDialog]) {
      const d = await agentWithQuote(page);
      const dialog = await driver.open(page, { clientId: d.client.id, quoteId: d.quoteId, transactionId: d.transactionId, title: "" });
      await driver.fill(dialog, "hay 7654321", SUPPLIER_REF);
      await driver.submit(dialog);
      await expect(dialog, driver.name).toBeHidden();
      expect((await dbBookingFor(d.transactionId)).hays_ref, driver.name).toBe("HAY-7654321");
    }
  });

  test("the API enforces the same rules: bad refs are 400 with the message, a forgiving one is saved canonical", async ({ page }) => {
    const d = await agentWithQuote(page);
    for (const [hays, message] of [
      ["HAY-123456", HAYS_REF_MESSAGE],
      ["HAY-123456789", HAYS_REF_MESSAGE],
      ["ABC-1234567", HAYS_REF_MESSAGE],
      ["", "HAYS ref is required"],
    ]) {
      const res = await page.request.post(`/api/v2/bookings/convert/${d.quoteId}`, { data: { haysRef: hays, supplierRef: SUPPLIER_REF } });
      expect(res.status(), JSON.stringify(hays)).toBe(400);
      expect(await res.text(), JSON.stringify(hays)).toContain(message);
    }
    const noSupplier = await page.request.post(`/api/v2/bookings/convert/${d.quoteId}`, { data: { haysRef: "HAY-1234567", supplierRef: " " } });
    expect(noSupplier.status()).toBe(400);
    expect(await noSupplier.text()).toContain("Supplier ref is required");
    await expectNothingSaved(d.transactionId, d.quoteId);

    const ok = await page.request.post(`/api/v2/bookings/convert/${d.quoteId}`, { data: { haysRef: "hay 1234567", supplierRef: ` ${SUPPLIER_REF} ` } });
    expect(ok.status(), await ok.text()).toBe(201);
    expect(await dbBookingFor(d.transactionId)).toMatchObject({ hays_ref: "HAY-1234567", supplier_ref: SUPPLIER_REF });
  });
});

test.describe("one booking per deal", () => {
  test("a second booking for the same deal is refused with 400 'Transaction already has a booking', whichever way it is made", async ({ page }) => {
    const d = await agentWithQuote(page);
    const first = await page.request.post(`/api/v2/bookings/convert/${d.quoteId}`, { data: { haysRef: "HAY-1234567", supplierRef: SUPPLIER_REF } });
    expect(first.status(), await first.text()).toBe(201);

    const second = await page.request.post(`/api/v2/bookings/convert/${d.quoteId}`, { data: { haysRef: "HAY-7654321", supplierRef: "OTHER" } });
    expect(second.status()).toBe(400);
    expect((await second.json()).message).toBe("Transaction already has a booking");

    const manual = await page.request.post("/api/v2/bookings", {
      data: { transaction_id: d.transactionId, holiday_type_id: d.agency.ref.packageType, travel_date: "2027-06-14", hays_ref: "HAY-1111111", supplier_ref: "X" },
    });
    expect(manual.status()).toBe(400);
    expect((await manual.json()).message).toBe("Transaction already has a booking");

    const rows = await queryRows(`select hays_ref from booking_table where transaction_id = $1`, [d.transactionId]);
    expect(rows).toEqual([{ hays_ref: "HAY-1234567" }]);
  });

  test("another agency cannot convert a quote (404) and a lost quote shows no convert button", async ({ page, playwright, baseURL }) => {
    const d = await agentWithQuote(page);
    const other = await seedDealsAgency();
    const outsider = await playwright.request.newContext({ baseURL: baseURL!, extraHTTPHeaders: { "X-Forwarded-For": "10.7.7.7" } });
    const { expectLoginOk } = await import("../helpers/fixtures");
    await expectLoginOk(outsider, other.adminEmail);
    const res = await outsider.post(`/api/v2/bookings/convert/${d.quoteId}`, { data: { haysRef: "HAY-1234567", supplierRef: SUPPLIER_REF } });
    expect(res.status()).toBe(404);
    await outsider.dispose();
    await expectNothingSaved(d.transactionId, d.quoteId);

    // Control: while the quote is live, the page shows the convert button.
    await openQuotePage(page, d.client.id, d.quoteId);
    await expect(page.getByTestId("holiday-top-convert")).toBeVisible();

    const lost = await page.request.patch(`/api/v2/quotes/${d.quoteId}`, { data: { quote_status: "lost" } });
    expect(lost.status()).toBe(200);
    await openQuotePage(page, d.client.id, d.quoteId);
    // Wait until the quote's own buttons have rendered (Duplicate is shown for every editable quote), then check Convert is gone.
    await expect(page.getByTestId("holiday-top-duplicate")).toBeVisible();
    await expect(page.getByTestId("holiday-top-convert")).toHaveCount(0);
  });
});

test.describe("what carries from the quote to the booking", () => {
  test("prices, party, dates, destination, accommodation, flights, transfers, lounge pass, car hire, attraction tickets, airport parking and an extra hotel are copied exactly, on screen and in the database", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const title = `Carry ${unique("c")}`;
    const r = agency.ref;
    const payload = {
      ...quotePayload(agency, {
        title,
        travel_date: "2027-06-14",
        num_of_nights: 10,
        adult: 2,
        child: 1,
        infant: 1,
        sales_price: "3000.00",
        discounts: "100.00",
        service_charge: "40.00",
        package_commission: "240.00",
      }),
      price_per_person: "980.00",
      transfer_type: "Private",
      pre_booked_seats: "12A, 12B",
      flight_meals: true,
      outboundFlight: {
        departing_airport_id: r.airport,
        arrival_airport_id: r.airport2,
        departure_date_time: "2027-06-14T07:30:00",
        arrival_date_time: "2027-06-14T11:45:00",
        flight_number: "BA1234",
      },
      inboundFlight: {
        departing_airport_id: r.airport2,
        arrival_airport_id: r.airport,
        departure_date_time: "2027-06-24T12:30:00",
        arrival_date_time: "2027-06-24T14:55:00",
        flight_number: "BA4321",
      },
      primaryAccommodation: {
        accomodation_id: r.accommodation,
        board_basis_id: r.boardBasis,
        room_type: "Double sea view",
        no_of_nights: 10,
        check_in_date_time: "2027-06-14T15:00:00",
      },
      transfers: [
        {
          booking_ref: "TR-1",
          tour_operator_id: r.operator,
          pick_up_location: "Palma airport",
          drop_off_location: "Hotel Playa Azul",
          pick_up_time: "2027-06-14T12:30:00",
          drop_off_time: "2027-06-14T13:30:00",
          cost: "40.00",
          commission: "4.00",
          is_included_in_package: false,
        },
      ],
      loungePasses: [
        { booking_ref: "LG-1", airport_id: r.airport, terminal: "2", date_of_usage: "2027-06-14T00:00:00", tour_operator_id: r.operator, cost: "25.00", commission: "2.50", is_included_in_package: false },
      ],
      carHires: [
        { booking_ref: "CH-1", tour_operator_id: r.operator, pick_up_location: "Palma airport", drop_off_location: "Palma airport", pick_up_time: "2027-06-15T09:00:00", drop_off_time: "2027-06-18T09:00:00", no_of_days: 3, driver_age: 35, cost: "150.00", commission: "15.00", is_included_in_package: false },
      ],
      attractionTickets: [
        { booking_ref: "AT-1", tour_operator_id: r.operator, ticket_type: "Water park", date_of_visit: "2027-06-16T00:00:00", number_of_tickets: 4, cost: "120.00", commission: "12.00", is_included_in_package: false },
      ],
      airportParkings: [
        { booking_ref: "AP-1", tour_operator_id: r.operator, airport_id: r.airport, parking_type: "Meet and greet", parking_date: "2027-06-14T00:00:00", car_make: "Ford", car_model: "Focus", colour: "Blue", car_reg_number: "AB12CDE", duration: "10 days", cost: "95.00", commission: "9.50", is_included_in_package: false },
      ],
      extraAccommodations: [
        { booking_ref: "XA-1", tour_operator_id: r.operator, accomodation_id: r.accommodation, board_basis_id: r.boardBasis2, room_type: "Twin", check_in_date_time: "2027-06-24T00:00:00", no_of_nights: 2, cost: "180.00", commission: "18.00", is_included_in_package: false },
      ],
    };
    const created = await page.request.post("/api/v2/transactions", { data: { client_id: client.id, user_id: userId, quote: payload } });
    const deal = await dataOf<{ transaction: { id: string }; quote: { id: string } }>(created, 201);
    const quoteId = deal.quote.id;
    const transactionId = deal.transaction.id;

    // Copy the quote's rows before converting.
    const qBefore = await dbQuote(quoteId);
    // quote_accomodation.check_in_date_time is timestamptz, booking_accomodation's is timestamp: compare the UTC wall clock.
    const qAcc = await queryRows<Record<string, any>>(
      `select *, to_char(check_in_date_time at time zone 'UTC', 'YYYY-MM-DD HH24:MI') as check_in from quote_accomodation where quote_id = $1 order by is_primary desc, no_of_nights desc`,
      [quoteId],
    );
    const qFlights = await queryRows<Record<string, any>>(`select * from quote_flights where quote_id = $1 order by flight_type, departure_date_time`, [quoteId]);
    const qTransfers = await queryRows<Record<string, any>>(`select * from quote_transfers where quote_id = $1`, [quoteId]);
    const qLounge = await queryRows<Record<string, any>>(`select * from quote_lounge_pass where quote_id = $1`, [quoteId]);
    expect(qAcc).toHaveLength(2);
    expect(qFlights).toHaveLength(2);
    expect(qTransfers).toHaveLength(1);
    expect(qLounge).toHaveLength(1);
    const qCar = await queryRows<Record<string, any>>(`select * from quote_car_hire where quote_id = $1`, [quoteId]);
    const qTickets = await queryRows<Record<string, any>>(`select * from quote_attraction_ticket where quote_id = $1`, [quoteId]);
    const qParking = await queryRows<Record<string, any>>(`select * from quote_airport_parking where quote_id = $1`, [quoteId]);
    expect([qCar.length, qTickets.length, qParking.length]).toEqual([1, 1, 1]);

    const dialog = await clientHolidayDialog.open(page, { clientId: client.id, quoteId, transactionId, title });
    await clientHolidayDialog.fill(dialog, "HAY-4455667", SUPPLIER_REF);
    await clientHolidayDialog.submit(dialog);
    await expect(dialog).toBeHidden();

    const b = await dbBookingFor(transactionId);
    expect(b).toBeTruthy();
    expect(b).toMatchObject({
      holiday_type_id: qBefore.holiday_type_id,
      travel_date: "2027-06-14",
      title,
      num_of_nights: 10,
      adult: 2,
      child: 1,
      infant: 1,
      main_tour_operator_id: r.operator,
      transfer_type: "Private",
      pre_booked_seats: "12A, 12B",
      flight_meals: true,
      booking_status: "BOOKED",
    });
    // Money, compared as numbers.
    for (const col of ["sales_price", "package_commission", "discounts", "service_charge", "price_per_person"] as const) {
      expect(Number(b[col]), col).toBe(Number(qBefore[col]));
    }
    expect([Number(b.sales_price), Number(b.discounts), Number(b.service_charge), Number(b.package_commission), Number(b.price_per_person)]).toEqual([3000, 100, 40, 240, 1183.33]);
    // Per person includes the extras not in the package: (3000 − 100 + 40 + 610) ÷ 3 travellers (infants don't count).

    const bRows = async (table: string, order: string) =>
      queryRows<Record<string, any>>(`select * from ${table} where booking_id = $1 order by ${order}`, [b.id]);
    const bAcc = await queryRows<Record<string, any>>(
      `select *, to_char(check_in_date_time, 'YYYY-MM-DD HH24:MI') as check_in from booking_accomodation where booking_id = $1 order by is_primary desc, no_of_nights desc`,
      [b.id],
    );
    const bFlights = await bRows("booking_flights", "flight_type, departure_date_time");
    const bTransfers = await bRows("booking_transfers", "booking_ref");
    const bLounge = await bRows("booking_lounge_pass", "booking_ref");
    const bCar = await bRows("booking_car_hire", "booking_ref");
    const bTickets = await bRows("booking_attraction_ticket", "booking_ref");
    const bParking = await bRows("booking_airport_parking", "booking_ref");

    const same = (a: Record<string, any>[], bb: Record<string, any>[], cols: string[], label: string) => {
      expect(bb, `${label} count`).toHaveLength(a.length);
      a.forEach((row, i) => {
        for (const col of cols) {
          const x = row[col];
          const y = bb[i][col];
          const bothNumeric = typeof x === "string" && /^-?\d+(\.\d+)?$/.test(x);
          expect(bothNumeric ? Number(y) : y, `${label}[${i}].${col}`).toEqual(bothNumeric ? Number(x) : x);
        }
      });
    };
    same(qAcc, bAcc, ["accomodation_id", "board_basis_id", "room_type", "no_of_nights", "check_in", "is_primary", "cost", "commission", "booking_ref", "tour_operator_id"], "accommodation");
    same(qFlights, bFlights, ["flight_number", "departing_airport_id", "arrival_airport_id", "departure_date_time", "arrival_date_time", "flight_type"], "flights");
    same(qTransfers, bTransfers, ["pick_up_location", "drop_off_location", "pick_up_time", "drop_off_time", "cost", "commission", "booking_ref", "tour_operator_id"], "transfers");
    same(qLounge, bLounge, ["airport_id", "terminal", "date_of_usage", "cost", "commission", "booking_ref"], "lounge passes");
    same(qCar, bCar, ["booking_ref", "tour_operator_id", "pick_up_location", "drop_off_location", "pick_up_time", "drop_off_time", "no_of_days", "driver_age", "cost", "commission"], "car hire");
    same(qTickets, bTickets, ["booking_ref", "tour_operator_id", "ticket_type", "date_of_visit", "number_of_tickets", "cost", "commission"], "attraction tickets");
    same(qParking, bParking, ["booking_ref", "airport_id", "parking_type", "parking_date", "car_make", "car_model", "colour", "car_reg_number", "duration", "cost", "commission"], "airport parking");

    // On screen: the booking page shows the same numbers and places.
    await expect(page).toHaveURL(/holiday=booking:/);
    // Scoped to the booking panels, not the left-hand list of holidays.
    const main = page.getByTestId("holiday-main-column");
    await expect(page.getByTestId("holiday-refs-card")).toContainText("HAY-4455667");
    await expect(page.getByTestId("holiday-refs-card")).toContainText(SUPPLIER_REF);
    await expect(page.getByTestId("holiday-hero")).toContainText(title);
    await expect(main).toContainText("14/06/2027");
    await expect(main).toContainText("Hotel Playa Azul");
    await expect(main).toContainText("Majorca");
    await expect(main).toContainText("E2E Sun Holidays");
    await expect(main).toContainText("2 Adults");
    // The customer total is price - discount + service charge + the extras not included in the package:
    // 3000 - 100 + 40 + (transfer 40 + lounge 25 + car hire 150 + tickets 120 + parking 95 + extra hotel 180).
    await expect(page.getByTestId("holiday-hero")).toContainText("£3,550");
  });

  test("the booking shows on the client page under Bookings and in the pipeline's Booked column", async ({ page }) => {
    const d = await agentWithQuote(page);
    const res = await page.request.post(`/api/v2/bookings/convert/${d.quoteId}`, { data: { haysRef: "HAY-2468024", supplierRef: SUPPLIER_REF } });
    expect(res.status(), await res.text()).toBe(201);

    await page.goto(`/clients/${d.client.id}`);
    await page.getByTestId("all-holidays-panel").getByText("Bookings").first().click();
    await expect(page.getByTestId("all-holidays-panel").getByText(d.title)).toBeVisible();
    await expect(page.getByTestId("all-holidays-panel").getByText("£2,400")).toBeVisible();

    await page.goto("/pipeline");
    await expect(page.getByTestId("pipeline-column-booked").getByTestId(`pipeline-card-${d.transactionId}`)).toBeVisible();
    await expect(page.getByTestId("pipeline-column-quoted").getByTestId(`pipeline-card-${d.transactionId}`)).toHaveCount(0);
  });
});

test.describe("editing a booking's references", () => {
  async function legacy(page: Page) {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const b = await seedLegacyBooking({ userId, orgId: agency.orgId, branchId: agency.branchId, clientId: client.id, operatorId: agency.ref.operator, holidayTypeId: agency.ref.packageType });
    await page.goto(`/clients/${client.id}?holiday=booking:${b.bookingId}`);
    await expect(page.getByTestId("holiday-refs-card")).toBeVisible();
    return { agency, client, ...b };
  }

  async function openRefs(page: Page): Promise<Locator> {
    await page.getByTestId("holiday-refs-edit").click();
    const dialog = page.getByTestId("dialog-booking-refs");
    await expect(dialog).toBeVisible();
    return dialog;
  }

  test("an older booking with an old-format HAYS Ref can still have its Supplier Ref edited, and the old ref is kept as it was", async ({ page }) => {
    const b = await legacy(page);
    await expect(page.getByTestId("holiday-refs-card")).toContainText("HAYS-1234");
    const dialog = await openRefs(page);
    await expect(dialog.getByLabel("HAYS Ref")).toHaveValue("HAYS-1234");
    await dialog.getByLabel(/^Supplier Ref/).fill("NEW-SUP-9");
    await dialog.getByRole("button", { name: "Save references" }).click();
    await expectToast(page, "References saved");
    expect(await dbBookingFor(b.transactionId)).toMatchObject({ hays_ref: "HAYS-1234", supplier_ref: "NEW-SUP-9" });
  });

  test("changing the old ref is checked: a bad one is refused inline, a good one is saved canonical", async ({ page }) => {
    const b = await legacy(page);
    const dialog = await openRefs(page);
    const hays = dialog.getByLabel("HAYS Ref");

    await hays.fill("HAYS-99");
    await dialog.getByRole("button", { name: "Save references" }).click();
    await expect(dialog.locator("#refs-hays-err")).toHaveText(HAYS_REF_MESSAGE);

    await hays.fill("");
    await dialog.getByRole("button", { name: "Save references" }).click();
    await expect(dialog.locator("#refs-hays-err")).toHaveText("Enter the HAYS reference.");
    expect((await dbBookingFor(b.transactionId)).hays_ref).toBe("HAYS-1234");

    await hays.fill("hay 7654321");
    await dialog.getByRole("button", { name: "Save references" }).click();
    await expectToast(page, "References saved");
    expect((await dbBookingFor(b.transactionId)).hays_ref).toBe("HAY-7654321");
  });

  test("the API: an unchanged old ref passes, a changed one is checked, and a blank one is refused", async ({ page }) => {
    const b = await legacy(page);
    const patch = (data: Record<string, unknown>) => page.request.patch(`/api/v2/bookings/${b.bookingId}`, { data });
    expect((await patch({ hays_ref: "HAYS-1234", supplier_ref: "S2" })).status()).toBe(200);
    expect((await patch({ hays_ref: "HAYS-5678" })).status()).toBe(400);
    expect((await patch({ hays_ref: "" })).status()).toBe(400);
    expect((await patch({ supplier_ref: "  " })).status()).toBe(400);
    expect((await patch({ hays_ref: "hay-1234567" })).status()).toBe(200);
    expect(await dbBookingFor(b.transactionId)).toMatchObject({ hays_ref: "HAY-1234567", supplier_ref: "S2" });
  });
});

test.describe("manual booking creation", () => {
  async function openBookingDrawer(page: Page, clientId: string): Promise<Locator> {
    await page.goto(`/clients/${clientId}`);
    await page.getByTestId("client-index-create").click();
    await page.getByTestId("client-index-create-booking").click();
    const drawer = page.getByTestId("booking-create-drawer");
    await expect(drawer).toBeVisible();
    return drawer;
  }

  async function fillBasics(page: Page, drawer: Locator, title: string, hays: string, supplier: string): Promise<void> {
    await drawer.getByLabel("Hays Ref").fill(hays);
    await drawer.getByLabel("Supplier Ref").fill(supplier);
    await drawer.getByTestId("input-drawer-title").fill(title);
    await chooseOption(page, drawer.getByLabel("Holiday Type"), "Package Holiday");
    await pickDate(page, drawer.getByLabel("Travel Date"), "2027-09-10");
    await drawer.getByTestId("drawer-costing-price").fill("1999");
  }

  async function agentWithClient(page: Page): Promise<{ agency: DealsAgency; clientId: string }> {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    return { agency, clientId: client.id };
  }

  test("a good ref in any forgiving spelling is saved as HAY- plus digits, and the deal is booked", async ({ page }) => {
    const { clientId } = await agentWithClient(page);
    const title = `Manual ${unique("m")}`;
    const drawer = await openBookingDrawer(page, clientId);
    await fillBasics(page, drawer, title, "hay 1234567", "SUP-77");
    await drawer.getByTestId("form-drawer-submit").click();
    await expectToast(page, "Booking created");

    const [row] = await queryRows<Record<string, any>>(`select * from booking_table where title = $1`, [title]);
    expect(row).toMatchObject({ hays_ref: "HAY-1234567", supplier_ref: "SUP-77", travel_date: "2027-09-10" });
    expect(Number(row.sales_price)).toBe(1999);
    expect((await dbTransaction(row.transaction_id)).status).toBe("on_booking");
  });

  test("a bad ref is refused with the message under the field and a 'Can't save yet' notice; nothing is saved", async ({ page }) => {
    const { clientId } = await agentWithClient(page);
    const title = `Manual bad ${unique("m")}`;
    const drawer = await openBookingDrawer(page, clientId);
    await fillBasics(page, drawer, title, "", "SUP-77");
    const saves: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().includes("/api/v2/transactions")) saves.push(r.url());
    });
    const fieldError = drawer.getByTestId("drawer-booking-refs").getByText(HAYS_REF_MESSAGE);
    for (const bad of ["HAY-123456", "HAY-123456789", "ABC-1234567"]) {
      await drawer.getByLabel("Hays Ref").fill(bad);
      // Typing clears the previous message, so a message seen after Save belongs to THIS attempt.
      await expect(fieldError, `cleared before ${bad}`).toBeHidden();
      await drawer.getByTestId("form-drawer-submit").click();
      await expect(fieldError, bad).toBeVisible();
      await expect(drawer).toBeVisible();
    }
    expect(saves).toEqual([]); // no save request was ever sent
    expect(await queryRows(`select 1 from booking_table where title = $1`, [title])).toHaveLength(0);
  });

  // As it stands, blank references are allowed when a booking is created by hand (the convert dialogs
  // require both). This test pins that behaviour; change it together with the product rule.
  test("blank HAYS Ref and Supplier Ref are accepted as they stand today and saved as empty text", async ({ page }) => {
    const { clientId } = await agentWithClient(page);
    const title = `Manual blank ${unique("m")}`;
    const drawer = await openBookingDrawer(page, clientId);
    await fillBasics(page, drawer, title, "", "");
    await drawer.getByTestId("form-drawer-submit").click();
    await expectToast(page, "Booking created");
    const [row] = await queryRows<Record<string, any>>(`select hays_ref, supplier_ref from booking_table where title = $1`, [title]);
    expect(row).toEqual({ hays_ref: "", supplier_ref: "" });
  });

  test("the API on manual creation: bad ref 400, blank ref accepted, forgiving ref saved canonical", async ({ page }) => {
    const { agency, clientId } = await agentWithClient(page);
    const userId = await signIn(page, agency.agentEmail);
    const tag = unique("api");
    const create = (hays: string) =>
      page.request.post("/api/v2/transactions", {
        data: {
          client_id: clientId,
          user_id: userId,
          booking: { holiday_type_id: agency.ref.packageType, travel_date: "2027-09-10", hays_ref: hays, supplier_ref: "S", title: `${tag} ${hays || "blank"}` },
        },
      });
    expect((await create("HAY-12")).status()).toBe(400);
    expect((await create("")).status()).toBe(201);
    expect((await create("hay12345678")).status()).toBe(201);
    const refs = await queryRows<{ hays_ref: string }>(`select hays_ref from booking_table where title in ($1, $2) order by hays_ref`, [`${tag} blank`, `${tag} hay12345678`]);
    expect(refs.map((r) => r.hays_ref)).toEqual(["", "HAY-12345678"]);
    expect(await queryRows(`select 1 from booking_table where title = $1`, [`${tag} HAY-12`])).toHaveLength(0);
  });
});

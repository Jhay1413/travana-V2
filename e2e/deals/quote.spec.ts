import type { Locator, Page } from "@playwright/test";
import { OPERATOR_MESSAGES } from "../../shared/tour-operator-rules";
import { apiAddQuote, apiCreateClient, apiCreateEnquiry, apiCreateQuoteDeal, dbQuote, dbTransaction, openActionsMenu, openHoliday, signIn } from "../helpers/deals";
import { expect, expectToast, test } from "../helpers/fixtures";
import { queryRows, REF, seedDealsAgency, unique, type DealsAgency } from "../helpers/seed";
import { chooseOption, chooseSearchable, pickDate, setNumber } from "../helpers/ui";

/** The quote id in `?holiday=quote:<id>`. */
function quoteIdFromUrl(page: Page): string {
  const holiday = new URL(page.url()).searchParams.get("holiday") ?? "";
  expect(holiday).toMatch(/^quote:[0-9a-f-]{36}$/);
  return holiday.split(":")[1];
}

function operatorSelect(drawer: Locator) {
  return drawer.getByRole("combobox").filter({ hasText: /Select operator|E2E /i });
}

async function openQuoteDrawerFromClient(page: Page, clientId: string): Promise<Locator> {
  await page.goto(`/clients/${clientId}`);
  await page.getByTestId("client-index-create").click();
  await page.getByTestId("client-index-create-quote").click();
  const drawer = page.getByTestId("quote-create-drawer");
  await expect(drawer).toBeVisible();
  return drawer;
}

async function setAllQuoteStatus(page: Page, quoteId: string, status: string): Promise<void> {
  const res = await page.request.patch(`/api/v2/quotes/${quoteId}`, { data: { quote_status: status } });
  expect(res.status(), await res.text()).toBe(200);
}

test.describe("enquiry to quote", () => {
  test("converting an enquiry opens the quote drawer prefilled with the enquiry's details, and the saved quote keeps them", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const title = `Prefill ${unique("p")}`;
    const deal = await apiCreateEnquiry(page.request, agency, client.id, userId, {
      title,
      travel_date: "2027-06-14",
      adults: 2,
      children: 1,
      infants: 1,
      no_of_nights: 10,
      destinations: [agency.ref.destination],
      boardBases: [agency.ref.boardBasis],
      departureAirports: [agency.ref.airport],
      passengers: [{ type: "child", age: 6 }],
    });

    await openHoliday(page, client.id, "enquiry", deal.enquiryId);
    await openActionsMenu(page);
    await page.getByRole("menuitem", { name: "Convert to Quote" }).click();
    const drawer = page.getByTestId("convert-enquiry-drawer");
    await expect(drawer).toBeVisible();

    // Prefilled from the enquiry.
    await expect(drawer.getByTestId("input-drawer-title")).toHaveValue(title);
    await expect(drawer.getByLabel("Holiday Type")).toContainText("Package Holiday");
    await expect(drawer.getByLabel("Travel Date")).toContainText("14/06/2027");
    await expect(drawer.getByLabel("Nights")).toHaveValue("10");
    await expect(drawer.getByLabel("Adults", { exact: true })).toHaveValue("2");
    await expect(drawer.getByLabel("Children", { exact: true })).toHaveValue("1");
    await expect(drawer.getByLabel("Infants", { exact: true })).toHaveValue("1");
    await expect(drawer.getByLabel("Age 1")).toHaveValue("6");
    await expect(drawer.getByRole("combobox").filter({ hasText: "Majorca" })).toBeVisible();
    await expect(drawer.getByRole("combobox").filter({ hasText: REF.boardBasis[0] })).toBeVisible();

    // Add what the enquiry never had: an operator and a price.
    await chooseSearchable(page, operatorSelect(drawer), REF.operator);
    await drawer.getByTestId("drawer-costing-price").fill("2400");
    await drawer.getByTestId("form-drawer-submit").click();
    await expectToast(page, "Enquiry converted to quote!");
    await expect(page).toHaveURL(/holiday=quote:/);

    const q = await dbQuote(quoteIdFromUrl(page));
    expect(q).toMatchObject({
      transaction_id: deal.transactionId,
      title,
      holiday_type_id: agency.ref.packageType,
      travel_date: "2027-06-14",
      num_of_nights: 10,
      adult: 2,
      child: 1,
      infant: 1,
      main_tour_operator_id: agency.ref.operator,
      quote_status: "quoted",
    });
    expect(Number(q.sales_price)).toBe(2400);
    const ages = await queryRows<{ age: number }>(`select age from passengers where quote_id = $1 and type = 'child'`, [q.id]);
    expect(ages).toEqual([{ age: 6 }]);
    expect((await dbTransaction(deal.transactionId)).status).toBe("on_quote");
    // The deal moved on: it has exactly this one quote and its enquiry row is still there for reference.
    expect(await queryRows(`select 1 from quote_table where transaction_id = $1`, [deal.transactionId])).toHaveLength(1);
    expect(await queryRows(`select 1 from enquiry_table where id = $1`, [deal.enquiryId])).toHaveLength(1);
  });
});

test.describe("creating a quote", () => {
  test("a quote created from the client page keeps every value typed into the drawer", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const title = `Direct ${unique("d")}`;

    const drawer = await openQuoteDrawerFromClient(page, client.id);
    await drawer.getByTestId("input-drawer-title").fill(title);
    await chooseOption(page, drawer.getByLabel("Holiday Type"), "Package Holiday");
    await chooseSearchable(page, operatorSelect(drawer), REF.operator);
    await pickDate(page, drawer.getByLabel("Travel Date"), "2027-08-02");
    await setNumber(drawer.getByLabel("Nights"), 14);
    await setNumber(drawer.getByLabel("Adults", { exact: true }), 2);
    await setNumber(drawer.getByLabel("Children", { exact: true }), 2);
    await setNumber(drawer.getByLabel("Age 1"), 5);
    await setNumber(drawer.getByLabel("Age 2"), 9);
    await chooseSearchable(page, drawer.getByRole("combobox").filter({ hasText: "Select country" }), "Spain");
    await chooseSearchable(page, drawer.getByRole("combobox").filter({ hasText: "Search destinations" }), "Majorca");
    await chooseSearchable(page, drawer.getByRole("combobox").filter({ hasText: "Search resort" }), REF.resort);
    await chooseSearchable(page, drawer.getByRole("combobox").filter({ hasText: "Search accommodation" }), REF.accommodation);
    await chooseSearchable(page, drawer.getByRole("combobox").filter({ hasText: "Select board basis" }), REF.boardBasis[0]);
    await drawer.getByTestId("drawer-costing-price").fill("3150.50");
    await drawer.getByTestId("drawer-costing-discount").fill("50");
    await drawer.getByTestId("drawer-costing-serviceCharge").fill("20");
    await drawer.getByTestId("form-drawer-submit").click();
    await expectToast(page, "Quote created");

    const [created] = await queryRows<{ id: string }>(`select id from quote_table where title = $1`, [title]);
    const q = await dbQuote(created.id);
    expect(q).toMatchObject({
      title,
      holiday_type_id: agency.ref.packageType,
      main_tour_operator_id: agency.ref.operator,
      travel_date: "2027-08-02",
      num_of_nights: 14,
      adult: 2,
      child: 2,
      isQuoteCopy: false,
    });
    expect(Number(q.sales_price)).toBe(3150.5);
    expect(Number(q.discounts)).toBe(50);
    expect(Number(q.service_charge)).toBe(20);
    // 10% operator commission on 3150.50, less the discount, plus the service charge.
    expect(Number(q.package_commission)).toBeCloseTo(3150.5 * 0.1 - 50 + 20, 2);

    const [txn] = await queryRows<Record<string, any>>(`select * from transaction where id = $1`, [q.transaction_id]);
    expect(txn).toMatchObject({ client_id: client.id, user_id: userId, status: "on_quote", org_id: agency.orgId });
    const acc = await queryRows<Record<string, any>>(`select * from quote_accomodation where quote_id = $1`, [q.id]);
    expect(acc).toHaveLength(1);
    expect(acc[0]).toMatchObject({ accomodation_id: agency.ref.accommodation, board_basis_id: agency.ref.boardBasis });
  });

  test("child ages typed into the new-quote drawer are saved with the quote", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const title = `Ages ${unique("a")}`;
    const drawer = await openQuoteDrawerFromClient(page, client.id);
    await drawer.getByTestId("input-drawer-title").fill(title);
    await chooseOption(page, drawer.getByLabel("Holiday Type"), "Package Holiday");
    await pickDate(page, drawer.getByLabel("Travel Date"), "2027-08-02");
    await setNumber(drawer.getByLabel("Children", { exact: true }), 2);
    await setNumber(drawer.getByLabel("Age 1"), 5);
    await setNumber(drawer.getByLabel("Age 2"), 9);
    await drawer.getByTestId("form-drawer-submit").click();
    await expectToast(page, "Quote created");
    const [created] = await queryRows<{ id: string }>(`select id from quote_table where title = $1`, [title]);
    const ages = await queryRows<{ age: number }>(`select age from passengers where quote_id = $1 and type = 'child' order by age`, [created.id]);
    expect(ages.map((a) => a.age)).toEqual([5, 9]);
  });
  // (The drawer steps above are the same as in "a quote created from the client page keeps every value typed
  // into the drawer", which passes, so a problem with the steps themselves shows up there.)

  test("saving with no holiday type shows 'Package type is required' and a 'Can't save yet' message, and saves nothing", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const drawer = await openQuoteDrawerFromClient(page, client.id);
    await drawer.getByTestId("input-drawer-title").fill("No type");
    await drawer.getByTestId("form-drawer-submit").click();
    await expect(drawer.getByText("Package type is required")).toBeVisible();
    await expectToast(page, "Can't save yet");
    expect(await queryRows(`select 1 from transaction where client_id = $1`, [client.id])).toHaveLength(0);
  });

  test("a quote with no travel date is refused by the server, the drawer stays open and nothing is saved", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const drawer = await openQuoteDrawerFromClient(page, client.id);
    await chooseOption(page, drawer.getByLabel("Holiday Type"), "Package Holiday");
    await drawer.getByTestId("drawer-costing-price").fill("999");
    await drawer.getByTestId("form-drawer-submit").click();
    await expectToast(page, "Failed to create quote");
    await expect(drawer).toBeVisible();
    expect(await queryRows(`select 1 from transaction where client_id = $1`, [client.id])).toHaveLength(0);
  });

  test("the API refuses a quote with no holiday type or no travel date (400) and creates no deal", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    for (const quote of [
      { travel_date: "2027-06-14", quote_type: "manual" },
      { holiday_type_id: agency.ref.packageType, quote_type: "manual" },
    ]) {
      const res = await page.request.post("/api/v2/transactions", { data: { client_id: client.id, user_id: userId, quote } });
      expect(res.status(), JSON.stringify(quote)).toBe(400);
    }
    expect(await queryRows(`select 1 from transaction where client_id = $1`, [client.id])).toHaveLength(0);
  });

  test("the operator list offers only the agency's linked operators, and the API refuses one that is not linked (400), saving nothing", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);

    const drawer = await openQuoteDrawerFromClient(page, client.id);
    await operatorSelect(drawer).click();
    const listbox = page.getByRole("listbox").last();
    await expect(listbox.getByRole("option", { name: REF.operator })).toBeVisible();
    await expect(listbox.getByRole("option", { name: REF.unlinkedOperator })).toHaveCount(0);
    await operatorSelect(drawer).click();

    // Creating a new deal with a quote naming the unlinked operator.
    const bad = await page.request.post("/api/v2/transactions", {
      data: {
        client_id: client.id,
        user_id: userId,
        quote: { holiday_type_id: agency.ref.packageType, travel_date: "2027-06-14", quote_type: "manual", main_tour_operator_id: agency.ref.unlinkedOperator },
      },
    });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).message).toBe(OPERATOR_MESSAGES.notInList);
    expect(await queryRows(`select 1 from transaction where client_id = $1`, [client.id])).toHaveLength(0);

    // Adding a quote to an existing deal.
    const deal = await apiCreateQuoteDeal(page.request, agency, client.id, userId);
    const second = await page.request.post("/api/v2/quotes", {
      data: { transaction_id: deal.transactionId, isQuoteCopy: true, ...{ holiday_type_id: agency.ref.packageType, travel_date: "2027-06-14", quote_type: "manual", main_tour_operator_id: agency.ref.unlinkedOperator } },
    });
    expect(second.status()).toBe(400);
    expect((await second.json()).message).toBe(OPERATOR_MESSAGES.notInList);
    expect(await queryRows(`select 1 from quote_table where transaction_id = $1`, [deal.transactionId])).toHaveLength(1);
  });
});

test.describe("several quotes on one deal", () => {
  async function dealWithThreeQuotes(page: Page, agency: DealsAgency) {
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const main = await apiCreateQuoteDeal(page.request, agency, client.id, userId, { title: "Main option", sales_price: "2000" });
    const copyA = await apiAddQuote(page.request, agency, main.transactionId, { title: "Option A", sales_price: "2100" });
    const copyB = await apiAddQuote(page.request, agency, main.transactionId, { title: "Option B", sales_price: "2200" });
    return { userId, client, transactionId: main.transactionId, mainId: main.quoteId, copyA, copyB };
  }

  test("a deal can hold several quotes: exactly one is the main quote and the others are copies", async ({ page }) => {
    const agency = await seedDealsAgency();
    const d = await dealWithThreeQuotes(page, agency);
    const rows = await queryRows<{ id: string; isQuoteCopy: boolean }>(
      `select id, "isQuoteCopy" from quote_table where transaction_id = $1 and deleted_at is null`,
      [d.transactionId],
    );
    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => !r.isQuoteCopy).map((r) => r.id)).toEqual([d.mainId]);

    // The client page's Quotes tab lists the deal's quotes.
    await page.goto(`/clients/${d.client.id}`);
    await page.getByTestId("all-holidays-panel").getByRole("tab", { name: /Quotes/ }).or(page.getByTestId("all-holidays-panel").getByText("Quotes", { exact: true })).first().click();
    for (const title of ["Main option", "Option A", "Option B"]) {
      await expect(page.getByTestId("all-holidays-panel").getByText(title)).toBeVisible();
    }
  });

  // Posting a second quote with isQuoteCopy:false is not refused: the server stores it as a copy, so the deal keeps
  // exactly one main quote. The helper used above always posts copies, so this is the one test that sends the other value.
  test("a second quote posted as a main quote still leaves the deal with exactly one main quote", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const deal = await apiCreateQuoteDeal(page.request, agency, client.id, userId, { title: "Main option" });
    await apiAddQuote(page.request, agency, deal.transactionId, { title: "Pretends to be main", isQuoteCopy: false });
    const rows = await queryRows<{ id: string; isQuoteCopy: boolean }>(
      `select id, "isQuoteCopy" from quote_table where transaction_id = $1 and deleted_at is null`,
      [deal.transactionId],
    );
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => !r.isQuoteCopy).map((r) => r.id)).toEqual([deal.quoteId]);
  });

  // Two ways to lose a deal: the deal's Lost button only sets the quote status; changing the quote's status also
  // switches the deal off (is_active false). Either way a new main must leave the deal active again.
  for (const how of ["the deal's Lost button", "the quote's status"] as const) {
  test(`when the main quote is lost via ${how}, a new quote posted as main becomes the only main, the deal leaves Lost, is active and the quote is visible`, async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const deal = await apiCreateQuoteDeal(page.request, agency, client.id, userId, { title: "Dead main", sales_price: "1000" });
    const inColumn = async (column: string) =>
      (await (await page.request.get(`/api/v2/transactions/pipeline/${column}?limit=50`)).text()).includes(deal.transactionId);

    const dealActive = async () =>
      (await queryRows<{ is_active: boolean }>(`select is_active from transaction where id = $1`, [deal.transactionId]))[0].is_active;
    const lost =
      how === "the deal's Lost button"
        ? await page.request.post(`/api/v2/transactions/${deal.transactionId}/lost`, { data: { lost: true } })
        : await page.request.patch(`/api/v2/quotes/${deal.quoteId}`, { data: { quote_status: "lost" } });
    expect(lost.status(), await lost.text()).toBe(200);
    expect(await inColumn("lost")).toBe(true); // set-up proof: the deal really is in Lost
    expect(await dealActive()).toBe(how === "the deal's Lost button"); // set-up proof: status path switches the deal off

    const newId = await apiAddQuote(page.request, agency, deal.transactionId, { title: "Fresh main", sales_price: "2500", isQuoteCopy: false });

    const rows = await queryRows<{ id: string; isQuoteCopy: boolean; quote_status: string }>(
      `select id, "isQuoteCopy", quote_status from quote_table where transaction_id = $1 and deleted_at is null`,
      [deal.transactionId],
    );
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => !r.isQuoteCopy).map((r) => r.id)).toEqual([newId]);
    expect(rows.find((r) => r.id === deal.quoteId)).toMatchObject({ isQuoteCopy: true, quote_status: "lost" });

    expect(await inColumn("lost")).toBe(false);
    expect(await inColumn("quote")).toBe(true);
    expect(await dealActive()).toBe(true);

    await page.goto(`/clients/${client.id}`);
    await page.getByTestId("all-holidays-panel").getByRole("tab", { name: /Quotes/ }).or(page.getByTestId("all-holidays-panel").getByText("Quotes", { exact: true })).first().click();
    await expect(page.getByTestId("all-holidays-panel").getByText("Fresh main")).toBeVisible();
  });
  }

  test("lost, revived by a new main, lost again, then set back to quoted: the deal ends active with exactly one live main", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const deal = await apiCreateQuoteDeal(page.request, agency, client.id, userId, { title: "Q1", sales_price: "1000" });
    const patch = async (id: string, quote_status: string) => {
      const res = await page.request.patch(`/api/v2/quotes/${id}`, { data: { quote_status } });
      expect(res.status(), await res.text()).toBe(200);
    };
    const dealActive = async () =>
      (await queryRows<{ is_active: boolean }>(`select is_active from transaction where id = $1`, [deal.transactionId]))[0].is_active;

    await patch(deal.quoteId, "lost");
    expect(await dealActive()).toBe(false);
    const q2 = await apiAddQuote(page.request, agency, deal.transactionId, { title: "Q2", sales_price: "2000", isQuoteCopy: false });
    expect(await dealActive()).toBe(true);
    await patch(q2, "lost");
    expect(await dealActive()).toBe(false);
    await patch(q2, "quoted");

    // The demoted lost Q1 (a copy) no longer keeps the deal switched off.
    expect(await dealActive()).toBe(true);
    const rows = await queryRows<{ id: string; isQuoteCopy: boolean; quote_status: string }>(
      `select id, "isQuoteCopy", quote_status from quote_table where transaction_id = $1 and deleted_at is null`,
      [deal.transactionId],
    );
    expect(rows.filter((r) => !r.isQuoteCopy)).toMatchObject([{ id: q2, quote_status: "quoted" }]);
  });

  test("Duplicate Quote adds a copy to the same deal without changing the main quote", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const deal = await apiCreateQuoteDeal(page.request, agency, client.id, userId, { title: "Original", sales_price: "1800" });

    await openHoliday(page, client.id, "quote", deal.quoteId);
    await page.getByTestId("holiday-top-duplicate").click();
    const drawer = page.getByTestId("quote-create-drawer");
    await expect(drawer).toBeVisible();
    await drawer.getByTestId("input-drawer-title").fill("Alternative hotel");
    await drawer.getByTestId("form-drawer-submit").click();
    // The page's own toast (A copy of this quote was made...) replaces the dialog's "Quote copied".
    await expectToast(page, "A copy of this quote was made.");

    const rows = await queryRows<{ id: string; title: string; isQuoteCopy: boolean }>(
      `select id, title, "isQuoteCopy" from quote_table where transaction_id = $1 order by date_created, title`,
      [deal.transactionId],
    );
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === deal.quoteId)?.isQuoteCopy).toBe(false);
    expect(rows.find((r) => r.title === "Alternative hotel")?.isQuoteCopy).toBe(true);
  });

  test("Set as main quote makes the chosen copy the main quote and demotes the old one", async ({ page }) => {
    const agency = await seedDealsAgency();
    const d = await dealWithThreeQuotes(page, agency);

    await openHoliday(page, d.client.id, "quote", d.copyA);
    await openActionsMenu(page);
    await page.getByTestId("button-holiday-set-as-main-quote").click();
    await expectToast(page, "This quote is now the main quote.");

    const flags = Object.fromEntries(
      (await queryRows<{ id: string; isQuoteCopy: boolean }>(`select id, "isQuoteCopy" from quote_table where transaction_id = $1`, [d.transactionId])).map(
        (r) => [r.id, r.isQuoteCopy],
      ),
    );
    expect(flags).toEqual({ [d.copyA]: false, [d.mainId]: true, [d.copyB]: true });
  });

  test("a lost quote cannot be made the main quote: the server says so (400) and the main quote stays", async ({ page }) => {
    const agency = await seedDealsAgency();
    const d = await dealWithThreeQuotes(page, agency);
    await setAllQuoteStatus(page, d.copyA, "lost");

    // From the screen: the lost copy's own menu.
    await openHoliday(page, d.client.id, "quote", d.copyA);
    await openActionsMenu(page);
    await page.getByTestId("button-holiday-set-as-main-quote").click();
    await expectToast(page, "Couldn't set as main quote");

    // And straight at the API, for lost and archived.
    const lost = await page.request.patch(`/api/v2/quotes/${d.copyA}/primary`);
    expect(lost.status()).toBe(400);
    expect(await lost.text()).toContain("A lost or archived quote cannot be made primary");
    await setAllQuoteStatus(page, d.copyB, "archived");
    expect((await page.request.patch(`/api/v2/quotes/${d.copyB}/primary`)).status()).toBe(400);
    expect((await dbQuote(d.mainId)).isQuoteCopy).toBe(false);
    expect((await dbQuote(d.copyA)).isQuoteCopy).toBe(true);
  });

  test("deleting the main quote of a deal with other live quotes requires choosing a replacement, which is then promoted", async ({ page }) => {
    const agency = await seedDealsAgency();
    const d = await dealWithThreeQuotes(page, agency);
    await signIn(page, agency.adminEmail);

    await openHoliday(page, d.client.id, "quote", d.mainId);
    await openActionsMenu(page);
    await page.getByRole("menuitem", { name: "Delete Quote" }).click();
    const dialog = page.getByTestId("dialog-admin-delete-quote");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("list-delete-new-primary-options")).toBeVisible();
    await dialog.getByTestId("textarea-delete-reason").fill("Customer chose another option");
    // A reason alone is not enough.
    await expect(dialog.getByTestId("button-confirm-delete")).toBeDisabled();
    await dialog.getByTestId(`button-new-primary-${d.copyB}`).click();
    await expect(dialog.getByTestId("button-confirm-delete")).toBeEnabled();
    await dialog.getByTestId("button-confirm-delete").click();
    await expectToast(page, "Quote deleted successfully");

    expect((await dbQuote(d.mainId)).deleted_at).not.toBeNull();
    expect((await dbQuote(d.copyB)).isQuoteCopy).toBe(false);
    expect((await dbQuote(d.copyA)).isQuoteCopy).toBe(true);
  });

  test("deleting the only quote of a deal needs no replacement and removes it", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const deal = await apiCreateQuoteDeal(page.request, agency, client.id, userId, { title: "Only quote" });
    await signIn(page, agency.adminEmail);

    await openHoliday(page, client.id, "quote", deal.quoteId);
    await openActionsMenu(page);
    await page.getByRole("menuitem", { name: "Delete Quote" }).click();
    const dialog = page.getByTestId("dialog-admin-delete-quote");
    await expect(dialog.getByTestId("list-delete-new-primary-options")).toHaveCount(0);
    await dialog.getByTestId("textarea-delete-reason").fill("Entered by mistake");
    await dialog.getByTestId("button-confirm-delete").click();
    await expectToast(page, "Quote deleted successfully");
    expect((await dbQuote(deal.quoteId)).deleted_at).not.toBeNull();
  });

  test("deleting a copy needs no replacement; the main quote stays main", async ({ page }) => {
    const agency = await seedDealsAgency();
    const d = await dealWithThreeQuotes(page, agency);
    await signIn(page, agency.adminEmail);
    await openHoliday(page, d.client.id, "quote", d.copyA);
    await openActionsMenu(page);
    await page.getByRole("menuitem", { name: "Delete Quote" }).click();
    const dialog = page.getByTestId("dialog-admin-delete-quote");
    await expect(dialog.getByTestId("list-delete-new-primary-options")).toHaveCount(0);
    await dialog.getByTestId("textarea-delete-reason").fill("Not needed");
    await dialog.getByTestId("button-confirm-delete").click();
    await expectToast(page, "Quote deleted successfully");
    expect((await dbQuote(d.copyA)).deleted_at).not.toBeNull();
    expect((await dbQuote(d.mainId)).isQuoteCopy).toBe(false);
  });

  test("the API refuses deleting a main quote without a replacement (NEW_PRIMARY_REQUIRED) or with an invalid one (INVALID_NEW_PRIMARY, a lost quote)", async ({ page }) => {
    const agency = await seedDealsAgency();
    const d = await dealWithThreeQuotes(page, agency);
    await signIn(page, agency.adminEmail);
    const noReplacement = await page.request.post(`/api/v2/audit/delete-quote/${d.mainId}`, { data: { reason: "x" } });
    expect(noReplacement.status()).toBe(400);
    expect((await noReplacement.json()).message).toBe("NEW_PRIMARY_REQUIRED");

    await setAllQuoteStatus(page, d.copyA, "lost");
    const lostReplacement = await page.request.post(`/api/v2/audit/delete-quote/${d.mainId}`, { data: { reason: "x", newPrimaryQuoteId: d.copyA } });
    expect(lostReplacement.status()).toBe(400);
    expect((await lostReplacement.json()).message).toBe("INVALID_NEW_PRIMARY");

    // The plain DELETE route has the first of those rules too (no replacement named).
    const plain = await page.request.delete(`/api/v2/quotes/${d.mainId}`);
    expect(plain.status()).toBe(400);
    expect(await plain.text()).toContain("NEW_PRIMARY_REQUIRED");
    expect((await dbQuote(d.mainId)).deleted_at).toBeNull();
  });

  test("another agency cannot read, change or delete a quote (404)", async ({ page, playwright, baseURL }) => {
    const agency = await seedDealsAgency();
    const other = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const deal = await apiCreateQuoteDeal(page.request, agency, client.id, userId);

    const outsider = await playwright.request.newContext({ baseURL: baseURL!, extraHTTPHeaders: { "X-Forwarded-For": "10.8.8.8" } });
    const { expectLoginOk } = await import("../helpers/fixtures");
    await expectLoginOk(outsider, other.adminEmail);
    expect((await outsider.get(`/api/v2/quotes/${deal.quoteId}`)).status()).toBe(404);
    expect((await outsider.patch(`/api/v2/quotes/${deal.quoteId}`, { data: { title: "hijack" } })).status()).toBe(404);
    expect((await outsider.patch(`/api/v2/quotes/${deal.quoteId}/primary`)).status()).toBe(404);
    expect((await outsider.delete(`/api/v2/quotes/${deal.quoteId}`)).status()).toBe(404);
    const add = await outsider.post("/api/v2/quotes", { data: { transaction_id: deal.transactionId, ...{ holiday_type_id: other.ref.packageType, travel_date: "2027-06-14", quote_type: "manual" } } });
    expect(add.status()).toBe(404);
    await outsider.dispose();
    expect((await dbQuote(deal.quoteId)).deleted_at).toBeNull();
  });
});

test.describe("quote room type select", () => {
  test("the chosen room type is first in the list and ticked when the select is reopened", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const names = ["Apple room", "Banana room", "Cherry room"].map((n) => `${n} ${unique("r")}`);
    for (const name of names) await queryRows(`insert into room_type (name) values ($1)`, [name]);

    const drawer = await openQuoteDrawerFromClient(page, client.id);
    const trigger = drawer.getByRole("combobox").filter({ hasText: "Select room type" });
    await chooseSearchable(page, trigger, names[2]);

    await drawer.getByRole("combobox").filter({ hasText: names[2] }).click();
    const options = page.getByRole("listbox").last().getByRole("option");
    await expect(options.first()).toContainText(names[2]);
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "false");
  });
});

import { dbBookingFor, dbTransaction, signIn, uniqueSurname } from "../helpers/deals";
import { expect, expectToast, test } from "../helpers/fixtures";
import { queryRows, REF, seedDealsAgency, unique } from "../helpers/seed";
import { chooseSearchable, expectChip, pickDate, pressChip, setNumber } from "../helpers/ui";

/**
 * One whole story through real screens, no API shortcuts:
 * new client -> enquiry -> quote -> booking -> the booking on the client page and in the pipeline's Booked column.
 */
test("a new client becomes an enquiry, a quote and a booking, ending in the client page and the Booked column", async ({ page }) => {
  test.setTimeout(150_000);
  const agency = await seedDealsAgency();
  const userId = await signIn(page, agency.agentEmail);
  const last = uniqueSurname();
  const enquiryTitle = `Journey ${unique("j")}`;

  // 1. New client, from the header + menu.
  await page.goto("/clients");
  await page.getByTestId("button-primary-action").click();
  await page.getByTestId("button-primary-action-client").click();
  await page.getByTestId("input-first-name").fill("Jess");
  await page.getByTestId("input-last-name").fill(last);
  await page.getByTestId("input-phone").fill("07700900777");
  await page.getByTestId("input-email").fill(`${unique("j")}@e2e.test`);
  await page.getByTestId("form-drawer-submit").click();
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("client-center-header")).toContainText(`Jess ${last}`);
  const clientId = page.url().split("/").pop()!;

  // 2. Enquiry, from the client page.
  await page.getByTestId("client-index-create").click();
  await page.getByTestId("client-index-create-enquiry").click();
  const enquiry = page.getByTestId("enquiry-drawer");
  await expectChip(enquiry.getByTestId("select-holiday-type"), "Package Holiday");
  await enquiry.getByTestId("input-enquiry-title").fill(enquiryTitle);
  await chooseSearchable(page, enquiry.getByTestId("select-enquiry-country"), "Spain", { multi: true });
  await chooseSearchable(page, enquiry.getByTestId("select-enquiry-destination"), "Majorca", { multi: true });
  await pickDate(page, enquiry.getByTestId("input-travel-date"), "2027-07-05");
  await setNumber(enquiry.getByTestId("input-adults"), 2);
  await pressChip(enquiry.getByTestId("select-board-basis"), REF.boardBasis[0]);
  await enquiry.getByTestId("input-budget").fill("2600");
  await enquiry.getByTestId("form-drawer-submit").click();
  await expectToast(page, "Enquiry created successfully");
  const [enq] = await queryRows<{ id: string; transaction_id: string }>(`select id, transaction_id from enquiry_table where title = $1`, [enquiryTitle]);
  expect((await dbTransaction(enq.transaction_id)).status).toBe("on_enquiry");
  await expect(page.getByTestId("all-holidays-panel").getByText(enquiryTitle)).toBeVisible();

  // 3. Quote, by converting the enquiry.
  await page.goto(`/clients/${clientId}?holiday=enquiry:${enq.id}`);
  await page.getByTestId("holiday-top-actions").getByTestId("client-header-actions").click();
  await page.getByRole("menuitem", { name: "Convert to Quote" }).click();
  const quote = page.getByTestId("convert-enquiry-drawer");
  await expect(quote.getByTestId("input-drawer-title")).toHaveValue(enquiryTitle);
  await expect(quote.getByLabel("Travel Date")).toContainText("05/07/2027");
  await chooseSearchable(page, quote.getByRole("combobox").filter({ hasText: "Select operator" }), REF.operator);
  await quote.getByTestId("drawer-costing-price").fill("2600");
  await quote.getByTestId("form-drawer-submit").click();
  await expectToast(page, "Enquiry converted to quote!");
  await expect(page).toHaveURL(/holiday=quote:/);
  expect((await dbTransaction(enq.transaction_id)).status).toBe("on_quote");

  // 4. Booking, from the quote's Convert to booking dialog (forgiving spelling of the ref).
  await page.getByTestId("holiday-top-convert").click();
  const dialog = page.getByTestId("dialog-convert-booking");
  await dialog.getByLabel("HAYS Ref").fill("hay 1357913");
  await dialog.getByLabel(/^Supplier Ref/).fill("TUI 55512345");
  await dialog.getByRole("button", { name: "Confirm booking" }).click();
  await expectToast(page, "HAYS Ref HAY-1357913");
  await expect(page).toHaveURL(/holiday=booking:/);

  const booking = await dbBookingFor(enq.transaction_id);
  expect(booking).toMatchObject({ hays_ref: "HAY-1357913", supplier_ref: "TUI 55512345", travel_date: "2027-07-05", title: enquiryTitle });
  expect(Number(booking.sales_price)).toBe(2600);
  const txn = await dbTransaction(enq.transaction_id);
  expect(txn).toMatchObject({ status: "on_booking", client_id: clientId, user_id: userId });

  // 5. The booking is on the client page...
  await page.goto(`/clients/${clientId}`);
  await page.getByTestId("all-holidays-panel").getByText("Bookings").first().click();
  await expect(page.getByTestId("all-holidays-panel").getByText(enquiryTitle)).toBeVisible();
  await expect(page.getByTestId("all-holidays-panel").getByText("£2,600")).toBeVisible();

  // ...and in the pipeline's Booked column, no longer under Quotes.
  await page.goto("/pipeline");
  await expect(page.getByTestId("pipeline-column-booked").getByTestId(`pipeline-card-${enq.transaction_id}`)).toBeVisible();
  await expect(page.getByTestId("pipeline-column-quoted").getByTestId(`pipeline-card-${enq.transaction_id}`)).toHaveCount(0);
  await expect(page.getByTestId("pipeline-column-enquiry").getByTestId(`pipeline-card-${enq.transaction_id}`)).toHaveCount(0);
});

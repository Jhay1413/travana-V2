import type { Locator, Page } from "@playwright/test";
import { apiCreateClient, apiCreateEnquiry, openActionsMenu, openHoliday, signIn } from "../helpers/deals";
import { expect, expectToast, test } from "../helpers/fixtures";
import { queryRows, seedDealsAgency, unique } from "../helpers/seed";
import { chooseSearchable, expectChip, pickDate, pressChip, setNumber } from "../helpers/ui";

/** The Hot Tub Break and Cruise Package variants of the enquiry pop-up: create, what is saved, and the edit prefill. */

async function openEnquiryPopup(page: Page, clientId: string, holidayType: string): Promise<Locator> {
  await page.goto(`/clients/${clientId}`);
  await page.getByTestId("client-index-create").click();
  await page.getByTestId("client-index-create-enquiry").click();
  const popup = page.getByTestId("enquiry-drawer");
  await expect(popup).toBeVisible();
  await expectChip(popup.getByTestId("select-holiday-type"), "Package Holiday");
  await pressChip(popup.getByTestId("select-holiday-type"), holidayType);
  return popup;
}

async function openEdit(page: Page, clientId: string, enquiryId: string): Promise<Locator> {
  await openHoliday(page, clientId, "enquiry", enquiryId);
  await openActionsMenu(page);
  await page.getByRole("menuitem", { name: "Edit Enquiry" }).click();
  const popup = page.getByTestId("enquiry-drawer");
  await expect(popup).toBeVisible();
  return popup;
}

test.describe("Hot Tub Break enquiry pop-up", () => {
  test("shows the hot tub fields only, saves guests, pets, lodge and budget, and edit shows them again", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const title = `Hot tub ${unique("h")}`;

    const popup = await openEnquiryPopup(page, client.id, "Hot Tub Break");
    // Hot tub fields are present; package-only fields are not.
    for (const id of ["select-flexible-on-date", "select-weekend-lodge", "input-guests", "input-pets", "input-min-budget", "input-max-budget"]) {
      await expect(popup.getByTestId(id)).toBeVisible();
    }
    for (const id of ["select-star-rating", "select-board-basis", "select-enquiry-country", "input-adults", "select-cabin-type"]) {
      await expect(popup.getByTestId(id)).toHaveCount(0);
    }
    await expect(popup.getByTestId("select-flexibility")).toHaveCount(0); // only shown once "Flexible on date" is Yes

    await popup.getByTestId("input-enquiry-title").fill(title);
    await chooseSearchable(page, popup.getByTestId("select-enquiry-destination"), "Majorca", { multi: true });
    await pickDate(page, popup.getByTestId("input-travel-date"), "2027-09-03");
    await pressChip(popup.getByTestId("select-flexible-on-date"), "Yes");
    await pressChip(popup.getByTestId("select-flexibility"), "+/- 3 Days");
    await pressChip(popup.getByTestId("select-nights"), "3");
    await popup.getByTestId("select-nights").getByRole("button", { name: "7", exact: true }).click(); // drop the default 7
    await pressChip(popup.getByTestId("select-weekend-lodge"), "Yes");
    await setNumber(popup.getByTestId("input-guests"), 4);
    await setNumber(popup.getByTestId("input-pets"), 2);
    await popup.getByTestId("input-min-budget").fill("900");
    await popup.getByTestId("input-max-budget").fill("1500");
    await pressChip(popup.getByTestId("select-budget-type"), "Package");
    await popup.getByTestId("textarea-enquiry-notes").fill("Dog friendly please");

    await popup.getByTestId("form-drawer-submit").click();
    await expectToast(page, "Enquiry created successfully");
    await expect(page.getByTestId("enquiry-drawer")).toBeHidden();

    const [row] = await queryRows<Record<string, any>>(`select * from enquiry_table where title = $1`, [title]);
    expect(row).toMatchObject({
      holiday_type_id: agency.ref.hotTub,
      travel_date: "2027-09-03",
      no_of_guests: 4,
      no_of_pets: 2,
      weekend_lodge: "Yes",
      flexible_date: "Yes",
      no_of_nights: 3,
    });
    expect(row.flexible_nights).toEqual([3]);
    expect(Number(row.budget)).toBe(900);
    expect(Number(row.max_budget)).toBe(1500);
    expect(String(row.budget_type).toLowerCase()).toBe("package");
    const dest = await queryRows(`select destination_id from enquiry_destination where enquiry_id = $1`, [row.id]);
    expect(dest.map((d) => d.destination_id)).toEqual([agency.ref.destination]);

    // Edit shows the saved values.
    const edit = await openEdit(page, client.id, row.id);
    await expect(edit.getByTestId("input-enquiry-title")).toHaveValue(title);
    await expectChip(edit.getByTestId("select-holiday-type"), "Hot Tub Break");
    await expect(edit.getByTestId("input-guests")).toHaveValue("4");
    await expect(edit.getByTestId("input-pets")).toHaveValue("2");
    await expectChip(edit.getByTestId("select-weekend-lodge"), "Yes");
    await expectChip(edit.getByTestId("select-flexible-on-date"), "Yes");
    await expectChip(edit.getByTestId("select-nights"), "3");
    await expect(edit.getByTestId("input-min-budget")).toHaveValue("900");
    await expect(edit.getByTestId("input-max-budget")).toHaveValue("1500");
    await expect(edit.getByTestId("input-travel-date")).toContainText("03/09/2027");
    await expect(edit.getByTestId("select-enquiry-destination")).toContainText("Majorca");

    // A saved change lands on the same enquiry; pets 0 is stored as 0.
    await setNumber(edit.getByTestId("input-pets"), 0);
    await edit.getByTestId("form-drawer-submit").click();
    await expectToast(page, "Enquiry updated");
    const [after] = await queryRows<Record<string, any>>(`select no_of_pets, no_of_guests from enquiry_table where id = $1`, [row.id]);
    expect(after).toMatchObject({ no_of_pets: 0, no_of_guests: 4 });
  });
});

test.describe("Cruise Package enquiry pop-up", () => {
  test("shows the cruise fields only, saves flexibility, cabin and stay days, and edit shows them again", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const title = `Cruise ${unique("c")}`;

    const popup = await openEnquiryPopup(page, client.id, "Cruise Package");
    for (const id of ["select-cruise-destination", "select-cabin-type", "input-cruise-line", "input-pre-cruise-days", "input-post-cruise-days", "input-min-budget", "input-max-budget", "input-adults"]) {
      await expect(popup.getByTestId(id)).toBeVisible();
    }
    for (const id of ["select-star-rating", "select-board-basis", "input-guests", "input-pets", "select-weekend-lodge"]) {
      await expect(popup.getByTestId(id)).toHaveCount(0);
    }
    // Cruise flexibility has "Any Time", not "Anytime in Month".
    await expect(popup.getByTestId("select-flexibility").getByRole("button", { name: "Any Time", exact: true })).toBeVisible();
    await expect(popup.getByTestId("select-flexibility").getByRole("button", { name: "Anytime in Month", exact: true })).toHaveCount(0);

    await popup.getByTestId("input-enquiry-title").fill(title);
    await chooseSearchable(page, popup.getByTestId("select-cruise-destination"), "Majorca");
    await pressChip(popup.getByTestId("chips-departure-airport"), /Newcastle/);
    await pickDate(page, popup.getByTestId("input-travel-date"), "2027-10-11");
    await pressChip(popup.getByTestId("select-flexibility"), "Any Time");
    await setNumber(popup.getByTestId("input-adults"), 2);
    await setNumber(popup.getByTestId("input-children"), 1);
    await setNumber(popup.getByTestId("input-child-age-0"), 9);
    await popup.getByTestId("input-min-budget").fill("2000");
    await popup.getByTestId("input-max-budget").fill("3500");
    await pressChip(popup.getByTestId("select-budget-type"), "Per Person");
    await popup.getByTestId("input-cruise-line").fill("Test Line");
    await pressChip(popup.getByTestId("select-cabin-type"), "Balcony");
    await popup.getByTestId("input-pre-cruise-days").fill("2");
    await popup.getByTestId("input-post-cruise-days").fill("3");

    await popup.getByTestId("form-drawer-submit").click();
    await expectToast(page, "Enquiry created successfully");
    await expect(page.getByTestId("enquiry-drawer")).toBeHidden();

    const [cruiseType] = await queryRows<{ id: string }>(`select id from package_type_table where name = 'Cruise Package'`);
    const [row] = await queryRows<Record<string, any>>(`select * from enquiry_table where title = $1`, [title]);
    expect(row).toMatchObject({
      holiday_type_id: cruiseType.id,
      travel_date: "2027-10-11",
      adults: 2,
      children: 1,
      flexibility_date: "Any Time",
      cabin_type: "Balcony",
      pre_cruise_stay: 2,
      post_cruise_stay: 3,
    });
    expect(Number(row.budget)).toBe(2000);
    expect(Number(row.max_budget)).toBe(3500);
    expect(String(row.budget_type).toLowerCase().replace(/[^a-z]/g, "")).toBe("perperson");
    expect((await queryRows(`select 1 from enquiry_destination where enquiry_id = $1 and destination_id = $2`, [row.id, agency.ref.destination])).length).toBe(1);
    expect((await queryRows(`select 1 from enquiry_departure_airport where enquiry_id = $1 and airport_id = $2`, [row.id, agency.ref.airport])).length).toBe(1);
    const pax = await queryRows<{ type: string; age: number }>(`select type, age from enquiry_passenger where enquiry_id = $1`, [row.id]);
    expect(pax).toEqual([{ type: "child", age: 9 }]);

    const edit = await openEdit(page, client.id, row.id);
    await expectChip(edit.getByTestId("select-holiday-type"), "Cruise Package");
    await expectChip(edit.getByTestId("select-flexibility"), "Any Time");
    await expectChip(edit.getByTestId("select-cabin-type"), "Balcony");
    await expect(edit.getByTestId("input-pre-cruise-days")).toHaveValue("2");
    await expect(edit.getByTestId("input-post-cruise-days")).toHaveValue("3");
    await expect(edit.getByTestId("input-min-budget")).toHaveValue("2000");
    await expect(edit.getByTestId("input-max-budget")).toHaveValue("3500");
    await expect(edit.getByTestId("input-child-age-0")).toHaveValue("9");
    await expect(edit.getByTestId("select-cruise-destination")).toContainText("Majorca");
  });

  test("editing an enquiry shows its saved budget type as the chosen chip", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const deal = await apiCreateEnquiry(page.request, agency, client.id, userId, { title: `Budget type ${unique("b")}`, budget: "1000", budget_type: "PER_PERSON" });
    const edit = await openEdit(page, client.id, deal.enquiryId);
    await expectChip(edit.getByTestId("select-budget-type"), "Per Person");
  });

  test("switching from Cruise to another holiday type clears the destination, so a cruise destination does not carry over", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const popup = await openEnquiryPopup(page, client.id, "Cruise Package");
    await chooseSearchable(page, popup.getByTestId("select-cruise-destination"), "Majorca");
    await expect(popup.getByTestId("select-cruise-destination")).toContainText("Majorca");
    await pressChip(popup.getByTestId("select-holiday-type"), "Package Holiday");
    await expect(popup.getByTestId("select-enquiry-destination")).not.toContainText("Majorca");
    await expect(popup.getByTestId("select-enquiry-country")).not.toContainText("Spain");
  });
});

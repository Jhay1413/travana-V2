import type { Page } from "@playwright/test";
import { apiCreateClient, apiCreateEnquiry, openActionsMenu, signIn } from "../helpers/deals";
import { expect, expectToast, test } from "../helpers/fixtures";
import { queryRows, REF, seedDealsAgency, unique } from "../helpers/seed";
import { chooseOption, chooseSearchable, pickDate, setNumber } from "../helpers/ui";

/**
 * The enquiry form is the "Create / Edit Enquiry" drawer (EnquiryWizard in drawer presentation): three
 * collapsible sections (Holiday Details, Travel & Passengers, Accommodation & Budget) and one Create
 * button. The step-by-step dialog presentation (dialog-enquiry-wizard, button-wizard-next/back/submit)
 * exists in the component but nothing in the app opens it, so it cannot be reached from a real screen.
 */

async function openEnquiryDrawer(page: Page, clientId: string) {
  await page.goto(`/clients/${clientId}`);
  await page.getByTestId("client-index-create").click();
  await page.getByTestId("client-index-create-enquiry").click();
  const drawer = page.getByTestId("enquiry-drawer");
  await expect(drawer).toBeVisible();
  // The default holiday type is applied once the lookups arrive.
  await expect(drawer.getByTestId("select-holiday-type")).toContainText("Package Holiday");
  return drawer;
}

interface FilledEnquiry {
  title: string;
  travelDate: string;
  notes: string;
}

/** Fills every section of the package-holiday enquiry with distinctive values. */
async function fillFullEnquiry(page: Page, title: string): Promise<FilledEnquiry> {
  const filled: FilledEnquiry = { title, travelDate: "2027-06-14", notes: `Wants a quiet resort ${unique("n")}` };
  const drawer = page.getByTestId("enquiry-drawer");

  // Section 1: Holiday Details
  await drawer.getByTestId("input-enquiry-title").fill(title);
  await chooseSearchable(page, drawer.getByTestId("select-enquiry-country"), "Spain", { multi: true });
  await chooseSearchable(page, drawer.getByTestId("select-enquiry-destination"), "Majorca", { multi: true });
  await chooseSearchable(page, drawer.getByTestId("select-enquiry-resort"), REF.resort, { multi: true });
  await chooseSearchable(page, drawer.getByTestId("select-enquiry-accommodation"), REF.accommodation, { multi: true });

  // Section 2: Travel & Passengers
  await chooseSearchable(page, drawer.getByTestId("input-departure-airport"), "Newcastle", { multi: true });
  await pickDate(page, drawer.getByTestId("input-travel-date"), filled.travelDate);
  await chooseOption(page, drawer.getByTestId("select-flexibility"), "+/- 3 Days");
  await setNumber(drawer.getByTestId("input-adults"), 3);
  await setNumber(drawer.getByTestId("input-children"), 1);
  await setNumber(drawer.getByTestId("input-child-age-0"), 7);
  await setNumber(drawer.getByTestId("input-infants"), 1);

  // Section 3: Accommodation & Budget
  await chooseOption(page, drawer.getByTestId("select-star-rating"), "4 Star");
  await chooseSearchable(page, drawer.getByTestId("select-board-basis"), REF.boardBasis[0], { multi: true });
  await drawer.getByTestId("input-budget").fill("3200");
  await chooseOption(page, drawer.getByTestId("select-budget-type"), "Package");
  await drawer.getByTestId("textarea-enquiry-notes-step2").fill(filled.notes);
  return filled;
}

test.describe("enquiry drawer", () => {
  test("a full enquiry from a client is saved with every value, shows on the client page and in the pipeline's Enquiries column", async ({
    page,
  }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const title = `Majorca family ${unique("t")}`;

    await openEnquiryDrawer(page, client.id);
    const filled = await fillFullEnquiry(page, title);
    await page.getByTestId("form-drawer-submit").click();
    await expectToast(page, "Enquiry created successfully");
    await expect(page.getByTestId("enquiry-drawer")).toBeHidden();

    // Saved values.
    const [row] = await queryRows<Record<string, any>>(
      `select e.*, t.client_id, t.user_id, t.status as txn_status, t.org_id, t.branch_id
         from enquiry_table e join transaction t on t.id = e.transaction_id
        where e.title = $1`,
      [title],
    );
    expect(row).toBeTruthy();
    expect(row).toMatchObject({
      holiday_type_id: agency.ref.packageType,
      travel_date: filled.travelDate,
      adults: 3,
      children: 1,
      infants: 1,
      no_of_nights: 7,
      accom_min_star_rating: "4 Star",
      flexibility_date: "+/- 3 Days",
      client_id: client.id,
      user_id: userId,
      txn_status: "on_enquiry",
      org_id: agency.orgId,
      branch_id: agency.branchId,
    });
    expect(Number(row.budget)).toBe(3200);
    expect(String(row.budget_type).toLowerCase()).toBe("package");
    expect(row.flexible_nights).toEqual([7]);
    const id = row.id as string;
    const dest = await queryRows(`select destination_id from enquiry_destination where enquiry_id = $1`, [id]);
    expect(dest.map((d) => d.destination_id)).toEqual([agency.ref.destination]);
    expect((await queryRows(`select 1 from enquiry_resorts where enquiry_id = $1 and resorts_id = $2`, [id, agency.ref.resort])).length).toBe(1);
    expect((await queryRows(`select 1 from enquiry_accomodation where enquiry_id = $1 and accomodation_id = $2`, [id, agency.ref.accommodation])).length).toBe(1);
    expect((await queryRows(`select 1 from enquiry_board_basis where enquiry_id = $1 and board_basis_id = $2`, [id, agency.ref.boardBasis])).length).toBe(1);
    expect((await queryRows(`select 1 from enquiry_departure_airport where enquiry_id = $1 and airport_id = $2`, [id, agency.ref.airport])).length).toBe(1);
    const pax = await queryRows<{ type: string; age: number }>(`select type, age from enquiry_passenger where enquiry_id = $1`, [id]);
    expect(pax).toEqual([{ type: "child", age: 7 }]);
    const notes = await queryRows<{ content: string }>(`select content from notes where transaction_id = $1`, [row.transaction_id]);
    expect(notes.map((n) => n.content).join(" ")).toContain(filled.notes);

    // On the client page (the Live deals rail, Enquiry tab).
    await expect(page.getByTestId("all-holidays-panel").getByText(title)).toBeVisible();

    // And on the pipeline, in the Enquiries column.
    await page.goto("/pipeline");
    await expect(page.getByTestId("pipeline-column-enquiry").getByTestId(`pipeline-title-${row.transaction_id}`)).toContainText(title);
  });

  test("Create Enquiry stays disabled, with a hint, until the title is filled in; nothing is saved without it", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const drawer = await openEnquiryDrawer(page, client.id);

    const submit = drawer.getByTestId("form-drawer-submit");
    await expect(submit).toBeDisabled();
    await expect(drawer.getByText("Enter a title and holiday type to save.")).toBeVisible();

    await drawer.getByTestId("input-enquiry-title").fill("   ");
    await expect(submit).toBeDisabled(); // spaces do not count

    await drawer.getByTestId("input-enquiry-title").fill("Algarve week");
    await expect(submit).toBeEnabled();
    await expect(drawer.getByText("Enter a title and holiday type to save.")).toBeHidden();

    await drawer.getByTestId("input-enquiry-title").fill("");
    await expect(submit).toBeDisabled();
    expect(await queryRows(`select 1 from transaction where client_id = $1`, [client.id])).toHaveLength(0);
  });

  test("the title is the only hard requirement: a minimal enquiry saves with the defaults (2 adults, 7 nights)", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const title = `Minimal ${unique("m")}`;
    const drawer = await openEnquiryDrawer(page, client.id);
    await drawer.getByTestId("input-enquiry-title").fill(title);
    await drawer.getByTestId("form-drawer-submit").click();
    await expectToast(page, "Enquiry created successfully");

    const [row] = await queryRows<Record<string, any>>(`select * from enquiry_table where title = $1`, [title]);
    expect(row).toMatchObject({ adults: 2, no_of_nights: 7, holiday_type_id: agency.ref.packageType, status: "ACTIVE" });
    expect(row.travel_date).toBeNull();
  });

  test("collapsing and re-opening a section keeps what was typed in every section", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const drawer = await openEnquiryDrawer(page, client.id);
    const title = `Keeps values ${unique("k")}`;
    await drawer.getByTestId("input-enquiry-title").fill(title);
    await setNumber(drawer.getByTestId("input-adults"), 4);
    await drawer.getByTestId("input-budget").fill("2750");

    for (const n of [0, 1, 2]) {
      const section = drawer.getByTestId(`enquiry-drawer-section-${n}`);
      await section.getByRole("button", { name: "Collapse section" }).click();
      await expect(section).toHaveAttribute("data-state", "closed");
    }
    for (const n of [0, 1, 2]) {
      const section = drawer.getByTestId(`enquiry-drawer-section-${n}`);
      await section.getByRole("button", { name: "Expand section" }).click();
      await expect(section).toHaveAttribute("data-state", "open");
    }
    await expect(drawer.getByTestId("input-enquiry-title")).toHaveValue(title);
    await expect(drawer.getByTestId("input-adults")).toHaveValue("4");
    await expect(drawer.getByTestId("input-budget")).toHaveValue("2750");
    await expect(drawer.getByTestId("form-drawer-submit")).toBeEnabled();
  });

  test("closing the drawer saves nothing, and reopening it shows an empty form", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const drawer = await openEnquiryDrawer(page, client.id);
    await drawer.getByTestId("input-enquiry-title").fill("Abandoned");
    await page.getByTestId("form-drawer-close").click();
    await expect(page.getByTestId("enquiry-drawer")).toBeHidden();
    expect(await queryRows(`select 1 from transaction where client_id = $1`, [client.id])).toHaveLength(0);

    await page.getByTestId("client-index-create").click();
    await page.getByTestId("client-index-create-enquiry").click();
    await expect(page.getByTestId("input-enquiry-title")).toHaveValue("");
  });

  test("editing a saved enquiry reopens the drawer with its values, and saving a change updates the same enquiry", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const title = `Edit me ${unique("e")}`;
    const deal = await apiCreateEnquiry(page.request, agency, client.id, userId, {
      title,
      adults: 3,
      no_of_nights: 10,
      budget: "1800",
      travel_date: "2027-07-01",
      destinations: [agency.ref.destination],
      boardBases: [agency.ref.boardBasis2],
    });

    await page.goto(`/clients/${client.id}?holiday=enquiry:${deal.enquiryId}`);
    await expect(page.getByTestId("holidays-rail").getByText(title)).toBeVisible();
    await openActionsMenu(page);
    await page.getByRole("menuitem", { name: "Edit Enquiry" }).click();

    const drawer = page.getByTestId("enquiry-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId("input-enquiry-title")).toHaveValue(title);
    await expect(drawer.getByTestId("input-adults")).toHaveValue("3");
    await expect(drawer.getByTestId("input-budget")).toHaveValue("1800");
    await expect(drawer.getByTestId("input-travel-date")).toContainText("01/07/2027");
    await expect(drawer.getByTestId("select-enquiry-destination")).toContainText("Majorca");
    await expect(drawer.getByTestId("select-board-basis")).toContainText(REF.boardBasis[1]);

    await drawer.getByTestId("input-budget").fill("2100");
    await drawer.getByTestId("form-drawer-submit").click();
    await expectToast(page, "Enquiry updated");
    const rows = await queryRows<{ budget: string; title: string }>(`select budget, title from enquiry_table where id = $1`, [deal.enquiryId]);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].budget)).toBe(2100);
    expect(rows[0].title).toBe(title);
  });

  test("control: the enquiry API accepts the same body once it has a holiday type (201)", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const res = await page.request.post("/api/v2/transactions", {
      data: { client_id: client.id, user_id: userId, enquiry: { title: "Has a type", holiday_type_id: agency.ref.packageType, status: "ACTIVE" } },
    });
    expect(res.status(), await res.text()).toBe(201);
  });

  // The control test above runs the same setup with a valid body, so a setup problem would fail that one,
  // not hide in here.
  test("an enquiry with no holiday type is refused with 400 and no deal is left behind", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const res = await page.request.post("/api/v2/transactions", {
      data: { client_id: client.id, user_id: userId, enquiry: { title: "No type", status: "ACTIVE" } },
    });
    expect(res.status()).toBe(400);
    expect(await queryRows(`select 1 from transaction where client_id = $1`, [client.id])).toHaveLength(0);
  });
});

/** A calendar day relative to today in London time (the browser under test runs in Europe/London). */
function isoDay(offsetDays: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offsetDays)).toISOString().slice(0, 10);
}

test.describe("enquiry travel date", () => {
  test("past days are greyed out in the Travel Date picker and today is selectable", async ({ page }) => {
    const agency = await seedDealsAgency();
    await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const drawer = await openEnquiryDrawer(page, client.id);

    await drawer.getByTestId("input-travel-date").click();
    await expect(page.getByTestId("date-picker-today")).toBeEnabled();
    await expect(page.locator(`td[data-day="${isoDay(0)}"] button`)).toBeEnabled();
    // Show the previous month so a past day is always on screen (yesterday may be hidden on the 1st).
    const [ty, tm] = isoDay(0).split("-").map(Number);
    const prevDate = new Date(Date.UTC(ty, tm - 2, 15));
    await page.locator('select[aria-label*="Year" i]').last().selectOption(String(prevDate.getUTCFullYear()));
    await page.locator('select[aria-label*="Month" i]').last().selectOption(String(prevDate.getUTCMonth()));
    await expect(page.locator(`td[data-day="${prevDate.toISOString().slice(0, 10)}"]:not([data-outside="true"]) button`)).toBeDisabled();
    // And back to this month.
    await page.locator('select[aria-label*="Year" i]').last().selectOption(String(ty));
    await page.locator('select[aria-label*="Month" i]').last().selectOption(String(tm - 1));
    await page.locator(`td[data-day="${isoDay(0)}"]:not([data-outside="true"]) button`).click();
    const [y, m, d] = isoDay(0).split("-");
    await expect(drawer.getByTestId("input-travel-date")).toContainText(`${d}/${m}/${y}`);
  });

  test("editing an enquiry whose travel date is already in the past still shows that date", async ({ page }) => {
    const agency = await seedDealsAgency();
    const userId = await signIn(page, agency.agentEmail);
    const client = await apiCreateClient(page.request);
    const title = `Past date ${unique("p")}`;
    const deal = await apiCreateEnquiry(page.request, agency, client.id, userId, { title, travel_date: "2020-01-15" });

    await page.goto(`/clients/${client.id}?holiday=enquiry:${deal.enquiryId}`);
    await expect(page.getByTestId("holidays-rail").getByText(title)).toBeVisible();
    await openActionsMenu(page);
    await page.getByRole("menuitem", { name: "Edit Enquiry" }).click();
    await expect(page.getByTestId("enquiry-drawer").getByTestId("input-travel-date")).toContainText("15/01/2020");
  });
});

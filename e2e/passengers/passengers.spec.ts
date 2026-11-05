/**
 * Client passengers (the Passengers block on the client page).
 * Owner rules (reversed 4 Nov, enforced on the server and in the UI, on add and edit, lead passport included): all six fields are
 * mandatory; a passport number is exactly 9 digits unless the Non-UK tick is set (then 5-20 letters/digits); the passport must
 * be valid for MORE than 6 months after the next booking departure (today in UK time when there is none). Passengers are saved
 * on the client and the client is the lead (name, title and date of birth come from the client record). Everyone who can open the client sees the passport numbers in full, read-only roles cannot edit, another agency sees nothing.
 *
 * Owner decision (3 Nov): agents may see and add passengers, including passport numbers, for ANY client in the agency, so
 * an agent of another shop is allowed. A branch manager stays pinned to their own shop.
 */
import type { Page } from "@playwright/test";
import { addDaysToKey, londonDayKey } from "../../client/src/lib/london-day";
import { apiCreateClient, dataOf, signIn } from "../helpers/deals";
import { expect, test } from "../helpers/fixtures";
import { pinLondonHelpers, plusMonths, shortLongDate } from "../helpers/london";
import { queryRows } from "../helpers/seed";
import { chooseOption } from "../helpers/ui";
import { quoteDeal } from "../helpers/pipeline";
import { seedBooking, workWorld, type WorkWorld } from "../helpers/work";

pinLondonHelpers("day", "months", "dayLabel");

const today = () => londonDayKey(new Date());

interface PassengerApi {
  id: string | null;
  isLead: boolean;
  title: string | null;
  firstName: string;
  surname: string;
  dateOfBirth: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  passportNonUk: boolean;
  passportWarning: boolean;
}

async function listPassengers(page: Page, clientId: string) {
  return dataOf<{ passengers: PassengerApi[]; nextDeparture: string | null }>(await page.request.get(`/api/v2/neon-clients/${clientId}/passengers`));
}

async function openClient(page: Page, clientId: string) {
  await page.goto(`/clients/${clientId}`);
  await expect(page.getByTestId("client-details-panel")).toBeVisible();
  await expect(page.getByTestId("passengers-loading")).toHaveCount(0);
  await expect(page.getByTestId("passenger-card-lead")).toBeVisible();
}

async function openAddModal(page: Page) {
  await page.getByTestId("button-add-passenger").click();
  const dialog = page.getByTestId("dialog-passenger");
  await expect(dialog).toBeVisible();
  return dialog;
}

interface Fill {
  title?: string;
  first?: string;
  last?: string;
  dob?: string;
  number?: string;
  expiry?: string;
}

async function fillPassenger(page: Page, dialog: ReturnType<Page["getByTestId"]>, f: Fill) {
  if (f.title !== undefined) await chooseOption(page, dialog.getByTestId("select-passenger-title"), f.title);
  if (f.first !== undefined) await dialog.getByTestId("input-passenger-first-name").fill(f.first);
  if (f.last !== undefined) await dialog.getByTestId("input-passenger-surname").fill(f.last);
  if (f.dob !== undefined) await dialog.getByTestId("input-passenger-dob").fill(f.dob);
  if (f.number !== undefined) await dialog.getByTestId("input-passenger-passport-number").fill(f.number);
  if (f.expiry !== undefined) await dialog.getByTestId("input-passenger-passport-expiry").fill(f.expiry);
}

const FAR_EXPIRY = () => plusMonths(today(), 60);

async function agentWithClient(page: Page, clientOverrides: Record<string, unknown> = {}) {
  const w = await workWorld(page);
  await signIn(page, w.agent.email);
  const client = await apiCreateClient(page.request, { title: "Mrs", firstName: "Lena", DOB: "1985-03-09", ...clientOverrides });
  return { w, client };
}

test.describe("Add Passenger needs all six fields", () => {
  test("Save stays disabled until title, first name, surname, date of birth, passport number and expiry are all filled; then it saves and the card shows them", async ({ page }) => {
    const { client } = await agentWithClient(page);
    await openClient(page, client.id);
    const dialog = await openAddModal(page);
    const save = dialog.getByTestId("button-save-passenger");
    await expect(dialog.getByRole("heading", { name: "Add passenger" })).toBeVisible();

    const full: Required<Fill> = { title: "Mr.", first: "Tom", last: "Traveller", dob: "1990-07-21", number: "123456789", expiry: FAR_EXPIRY() };
    const apply = async (key: keyof Fill) => fillPassenger(page, dialog, { [key]: full[key] });
    // Leave out one field at a time: every one of the six is mandatory.
    const order: Array<keyof Fill> = ["title", "first", "last", "dob", "number", "expiry"];
    for (const missing of order) {
      for (const key of order) if (key !== missing) await apply(key);
      await expect(save, `without ${missing}`).toBeDisabled();
      // Clear the form again for the next round.
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toBeHidden();
      await page.getByTestId("button-add-passenger").click();
      await expect(dialog).toBeVisible();
    }
    // Whitespace is not a name.
    await fillPassenger(page, dialog, { ...full, first: "   " });
    await expect(save).toBeDisabled();
    expect((await listPassengers(page, client.id)).passengers).toHaveLength(1); // only the lead; nothing was created

    await fillPassenger(page, dialog, full);
    await expect(save).toBeEnabled();
    await save.click();
    await expect(dialog).toBeHidden();

    const after = await listPassengers(page, client.id);
    expect(after.passengers).toHaveLength(2);
    const added = after.passengers[1];
    expect(added).toMatchObject({ isLead: false, title: "Mr.", firstName: "Tom", surname: "Traveller", dateOfBirth: "1990-07-21", passportNumber: "123456789", passportExpiry: full.expiry, passportWarning: false });
    const card = page.getByTestId(`passenger-card-${added.id}`);
    await expect(card).toContainText("PASSENGER 2");
    await expect(card).toContainText("Mr. Tom Traveller");
    await expect(card).toContainText("123456789"); // shown in full, not masked
    await expect(card).toContainText("21/07/1990");
    await expect(page.getByTestId("passenger-count")).toHaveText("2 passengers");
    expect(await queryRows(`select 1 from client_passenger where client_id = $1`, [client.id])).toHaveLength(1);
  });

  test("the server refuses a passenger with any of the six missing or a bad date, and creates nothing", async ({ page }) => {
    const { client } = await agentWithClient(page);
    const body = { title: "Ms", firstName: "Pia", surname: "Partner", dateOfBirth: "1991-01-02", passportNumber: "987654321", passportExpiry: FAR_EXPIRY() };
    const url = `/api/v2/neon-clients/${client.id}/passengers`;
    for (const key of Object.keys(body)) {
      const bad = { ...body } as Record<string, unknown>;
      delete bad[key];
      const res = await page.request.post(url, { data: bad });
      expect(res.status(), `without ${key}: ${await res.text()}`).toBe(400);
    }
    for (const [key, value] of [["dateOfBirth", "02/01/1991"], ["passportExpiry", "2031-02-30"], ["firstName", "  "], ["passportNumber", ""]] as const) {
      const res = await page.request.post(url, { data: { ...body, [key]: value } });
      expect(res.status(), `${key}=${value}: ${await res.text()}`).toBe(400);
    }
    expect((await listPassengers(page, client.id)).passengers).toHaveLength(1);
    expect((await page.request.post(url, { data: body })).status()).toBe(201); // control: the complete one saves
    expect((await listPassengers(page, client.id)).passengers).toHaveLength(2);
  });
});

const dmy = (ymd: string) => ymd.split("-").reverse().join("/");
const expiryMessage = (deadline: string) => `Passport must be valid for more than 6 months after travel (until after ${dmy(deadline)})`;
const UK_NUMBER_MESSAGE = "Passport number must be exactly 9 digits (tick Non-UK passport for other formats)";

test.describe("passport number: 9 digits, or Non-UK passport 5-20 letters/digits", () => {
  test("a bad number blocks Save with the message; 9 digits clears it; the Non-UK tick allows AB12345 and it is stored upper case", async ({ page }) => {
    const { client } = await agentWithClient(page);
    await openClient(page, client.id);
    const dialog = await openAddModal(page);
    const error = dialog.getByTestId("passenger-passport-number-error");
    const number = dialog.getByTestId("input-passenger-passport-number");
    const save = dialog.getByTestId("button-save-passenger");
    await fillPassenger(page, dialog, { title: "Ms", first: "Ola", last: "Overseas", dob: "1992-02-02", expiry: FAR_EXPIRY() });

    await expect(error).toHaveCount(0); // empty: nothing to complain about yet, but Save is still off
    await expect(save).toBeDisabled();
    await number.fill("12345678"); // 8 digits
    await expect(error).toHaveText(UK_NUMBER_MESSAGE);
    await expect(save).toBeDisabled();
    await expect(dialog.getByTestId("passenger-save-blocked-reason")).toHaveText(UK_NUMBER_MESSAGE);
    await number.fill("1234567890"); // 10 digits
    await expect(save).toBeDisabled();
    await number.fill("AB1234567"); // letters without the tick
    await expect(error).toBeVisible();
    await expect(save).toBeDisabled();
    await number.fill("123456789");
    await expect(error).toHaveCount(0);
    await expect(save).toBeEnabled();

    // Non-UK tick: 5-20 letters/digits, no spaces.
    await number.fill("ab12345");
    await expect(save).toBeDisabled();
    await dialog.getByTestId("checkbox-passenger-non-uk").check();
    await expect(error).toHaveCount(0);
    await expect(save).toBeEnabled();
    await number.fill("AB12"); // too short even for Non-UK
    await expect(error).toHaveText("Non-UK passport number must be 5 to 20 letters or digits, with no spaces");
    await expect(save).toBeDisabled();
    await number.fill("AB 12345"); // space
    await expect(save).toBeDisabled();
    await number.fill("ab12345");
    await expect(save).toBeEnabled();
    await save.click();
    await expect(dialog).toBeHidden();
    const saved = (await listPassengers(page, client.id)).passengers.find((p) => p.firstName === "Ola");
    expect(saved).toMatchObject({ passportNumber: "AB12345", passportNonUk: true });
  });

  test("the server refuses a bad number and accepts the Non-UK format", async ({ page }) => {
    const { client } = await agentWithClient(page);
    const url = `/api/v2/neon-clients/${client.id}/passengers`;
    const body = { title: "Ms", firstName: "Pia", surname: "Partner", dateOfBirth: "1991-01-02", passportNumber: "987654321", passportExpiry: FAR_EXPIRY() };
    const bad = await page.request.post(url, { data: { ...body, passportNumber: "AB12345" } });
    expect(bad.status()).toBe(400);
    expect(await bad.text()).toContain(UK_NUMBER_MESSAGE);
    expect((await page.request.post(url, { data: { ...body, passportNumber: "AB 123", passportNonUk: true } })).status()).toBe(400);
    expect((await page.request.post(url, { data: { ...body, passportNumber: "AB12", passportNonUk: true } })).status()).toBe(400);
    const ok = await page.request.post(url, { data: { ...body, passportNumber: "ab12345", passportNonUk: true } });
    expect(ok.status(), await ok.text()).toBe(201);
    expect((await listPassengers(page, client.id)).passengers.filter((p) => !p.isLead)).toHaveLength(1);
  });
});

test.describe("passport expiry must be MORE than 6 months after the next departure", () => {
  test("with no booking to travel on, the expiry is checked against today (UK): expired and exactly 6 months are blocked, a day later saves", async ({ page }) => {
    const { client } = await agentWithClient(page);
    await openClient(page, client.id);
    await expect(page.getByTestId("passenger-footnote")).toContainText("No upcoming bookings yet, so passport expiry is checked against today");

    const sixMonths = plusMonths(today(), 6);
    const url = `/api/v2/neon-clients/${client.id}/passengers`;
    const blocked = [
      { name: "Expired", expiry: addDaysToKey(today(), -30) },
      { name: "Exactly", expiry: sixMonths },
    ];
    for (const c of blocked) {
      const dialog = await openAddModal(page);
      await fillPassenger(page, dialog, { title: "Miss", first: c.name, last: "Flag", dob: "2000-01-01", number: "123456789", expiry: c.expiry });
      await expect(dialog.getByTestId("passenger-passport-expiry-error"), c.name).toHaveText(expiryMessage(sixMonths));
      await expect(dialog.getByTestId("button-save-passenger"), c.name).toBeDisabled();
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toBeHidden();
      const res = await page.request.post(url, { data: { title: "Miss", firstName: c.name, surname: "Flag", dateOfBirth: "2000-01-01", passportNumber: "123456789", passportExpiry: c.expiry } });
      expect(res.status(), c.name).toBe(400);
      expect(await res.text()).toContain(expiryMessage(sixMonths));
    }
    const dialog = await openAddModal(page);
    await expect(dialog.getByTestId("passenger-passport-expiry-hint")).toHaveText(`Must expire after ${dmy(sixMonths)} (6 months past travel)`);
    await fillPassenger(page, dialog, { title: "Miss", first: "Later", last: "Flag", dob: "2000-01-01", number: "123456789", expiry: addDaysToKey(sixMonths, 1) });
    await expect(dialog.getByTestId("passenger-passport-expiry-error")).toHaveCount(0);
    await expect(dialog.getByTestId("button-save-passenger")).toBeEnabled();
    await dialog.getByTestId("button-save-passenger").click();
    await expect(dialog).toBeHidden();
    expect((await listPassengers(page, client.id)).passengers.map((p) => p.firstName)).toEqual([client.firstName, "Later"]);
  });

  test("with a booking to come, the expiry is checked against the next departure; quotes, lost and past bookings do not set the departure", async ({ page }) => {
    const { w, client } = await agentWithClient(page);
    const world = { agency: w.agency, userId: w.agent.id, clientId: client.id, clientSurname: "" };
    const next = addDaysToKey(today(), 90);
    const later = addDaysToKey(today(), 200);
    await seedBooking(page.request, world, { title: "Later trip", packageCommission: 10, createdAt: new Date(), travelDate: later });
    await seedBooking(page.request, world, { title: "Next trip", packageCommission: 10, createdAt: new Date(), travelDate: next });
    const lost = await seedBooking(page.request, world, { title: "Lost sooner trip", packageCommission: 10, createdAt: new Date(), travelDate: addDaysToKey(today(), 20) });
    await queryRows(`update booking_table set booking_status = 'LOST' where id = $1`, [lost.bookingId]);
    await seedBooking(page.request, world, { title: "Past trip", packageCommission: 10, createdAt: new Date(), travelDate: addDaysToKey(today(), -5) });
    // A plain quote with an earlier travel date does not count: only bookings do.
    await quoteDeal(page.request, world, { title: "Sooner quote only", travel_date: addDaysToKey(today(), 30) });

    const deadline = plusMonths(next, 6);
    const url = `/api/v2/neon-clients/${client.id}/passengers`;
    const make = (surname: string, expiry: string) =>
      page.request.post(url, { data: { title: "Mr.", firstName: "Edge", surname, dateOfBirth: "1980-01-01", passportNumber: "111111111", passportExpiry: expiry } });
    const exact = await make("Exact", deadline);
    expect(exact.status()).toBe(400);
    expect(await exact.text()).toContain(expiryMessage(deadline));
    // Seven months from today is fine against today but inside 6 months of a departure 90 days away.
    expect((await make("Between", plusMonths(today(), 7))).status()).toBe(400);
    expect((await make("Later", addDaysToKey(deadline, 1))).status()).toBe(201);

    const api = await listPassengers(page, client.id);
    expect(api.nextDeparture).toBe(next);
    expect(api.passengers.filter((p) => !p.isLead).map((p) => p.surname)).toEqual(["Later"]);

    await openClient(page, client.id);
    await expect(page.getByTestId("passenger-footnote")).toContainText(`checked against the next departure, ${shortLongDate(next)}`);
    // On screen: the hint shows the deadline, the exact day is blocked with the message, the day after saves.
    const dialog = await openAddModal(page);
    await expect(dialog.getByTestId("passenger-passport-expiry-hint")).toHaveText(`Must expire after ${dmy(deadline)} (6 months past travel)`);
    await fillPassenger(page, dialog, { title: "Mr.", first: "Screen", last: "Edge", dob: "1980-01-01", number: "222222222", expiry: deadline });
    await expect(dialog.getByTestId("passenger-passport-expiry-error")).toHaveText(expiryMessage(deadline));
    await expect(dialog.getByTestId("button-save-passenger")).toBeDisabled();
    await dialog.getByTestId("input-passenger-passport-expiry").fill(addDaysToKey(deadline, 1));
    await expect(dialog.getByTestId("button-save-passenger")).toBeEnabled();
    await dialog.getByTestId("button-save-passenger").click();
    await expect(dialog).toBeHidden();
    expect((await listPassengers(page, client.id)).passengers.filter((p) => !p.isLead)).toHaveLength(2);
  });

  test("a legacy passenger already saved with a short-dated passport still shows the card warning", async ({ page }) => {
    const { client } = await agentWithClient(page);
    await queryRows(
      `insert into client_passenger (client_id, is_lead, title, first_name, surname, date_of_birth, passport_number, passport_expiry) values ($1, false, 'Mr.', 'Legacy', 'Short', '1970-01-01', '123456789', $2)`,
      [client.id, addDaysToKey(today(), 30)],
    );
    await openClient(page, client.id);
    await expect(page.getByTestId("passenger-passport-warning")).toHaveCount(1);
  });
});

test.describe("editing is held to the same rules", () => {
  test("an older passenger with gaps cannot be saved until every field is valid; once valid it saves, and editing it to an invalid value is blocked", async ({ page }) => {
    const { client } = await agentWithClient(page);
    // A record from before all six were mandatory: names only.
    const [row] = await queryRows<{ id: string }>(
      `insert into client_passenger (client_id, is_lead, first_name, surname) values ($1, false, 'Old', 'Record') returning id`,
      [client.id],
    );
    const patchUrl = `/api/v2/neon-clients/${client.id}/passengers/${row.id}`;
    // Even an unrelated change is refused while the record has gaps.
    const gap = await page.request.patch(patchUrl, { data: { firstName: "Older" } });
    expect(gap.status()).toBe(400);
    expect(await gap.text()).toContain("Title is required");

    await openClient(page, client.id);
    const card = page.getByTestId(`passenger-card-${row.id}`);
    await expect(card).toContainText("Old Record");
    await card.getByTestId(`passenger-edit-${row.id}`).click();
    const dialog = page.getByTestId("dialog-passenger");
    const save = dialog.getByTestId("button-save-passenger");
    await expect(dialog.getByRole("heading", { name: "Edit passenger" })).toBeVisible();
    await expect(save).toBeDisabled();
    await expect(dialog.getByTestId("passenger-save-blocked-reason")).toHaveText("Title is required");
    await fillPassenger(page, dialog, { title: "Mr.", dob: "1960-04-04", number: "12345" });
    await expect(dialog.getByTestId("passenger-passport-number-error")).toHaveText(UK_NUMBER_MESSAGE);
    await fillPassenger(page, dialog, { number: "123456789", expiry: addDaysToKey(today(), 30) });
    await expect(dialog.getByTestId("passenger-passport-expiry-error")).toBeVisible();
    await expect(save).toBeDisabled();
    await dialog.getByTestId("input-passenger-passport-expiry").fill(FAR_EXPIRY());
    await expect(save).toBeEnabled();
    await save.click();
    await expect(dialog).toBeHidden();
    const saved = (await listPassengers(page, client.id)).passengers.find((p) => p.id === row.id)!;
    expect(saved).toMatchObject({ firstName: "Old", title: "Mr.", dateOfBirth: "1960-04-04", passportNumber: "123456789", passportExpiry: FAR_EXPIRY(), passportWarning: false });

    // Now valid: an ordinary edit saves.
    expect((await page.request.patch(patchUrl, { data: { firstName: "Older" } })).status()).toBe(200);

    // Editing a valid passenger to an invalid value is blocked on screen and at the server.
    await page.getByTestId(`passenger-edit-${row.id}`).click();
    await dialog.getByTestId("input-passenger-passport-number").fill("1234");
    await expect(save).toBeDisabled();
    await dialog.getByTestId("input-passenger-passport-number").fill("123456789");
    await dialog.getByTestId("input-passenger-passport-expiry").fill("");
    await expect(save).toBeDisabled();
    await dialog.getByTestId("input-passenger-passport-expiry").fill(addDaysToKey(today(), 10));
    await expect(save).toBeDisabled();
    await dialog.getByTestId("input-passenger-first-name").fill("");
    await expect(save).toBeDisabled();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    expect((await page.request.patch(patchUrl, { data: { passportNumber: "1234" } })).status()).toBe(400);
    expect((await page.request.patch(patchUrl, { data: { passportExpiry: addDaysToKey(today(), 10) } })).status()).toBe(400);
    expect((await page.request.patch(patchUrl, { data: { passportNumber: "" } })).status()).toBe(400);
    const unchanged = (await listPassengers(page, client.id)).passengers.find((p) => p.id === row.id)!;
    expect(unchanged).toMatchObject({ firstName: "Older", passportNumber: "123456789", passportExpiry: FAR_EXPIRY() });

    // Delete is never blocked.
    await page.getByTestId(`passenger-edit-${row.id}`).click();
    await dialog.getByTestId("button-delete-passenger").click();
    await page.getByTestId("button-confirm-delete-passenger").click();
    await expect(page.getByTestId(`passenger-card-${row.id}`)).toHaveCount(0);
    expect(await queryRows(`select 1 from client_passenger where id = $1`, [row.id])).toHaveLength(0);
  });

  test("the lead's passport follows the same rules (number, Non-UK tick, expiry) while name and date of birth come from the client", async ({ page }) => {
    const { client } = await agentWithClient(page, { title: "Dr", firstName: "Lena", DOB: "1985-03-09" });
    await openClient(page, client.id);
    // The lead is always the first card (its test id changes from "lead" to its row id once a passport has been saved).
    const lead = page.locator('[data-testid^="passenger-card-"]').first();
    await expect(lead).toContainText("LEAD PASSENGER");
    await expect(lead).toContainText(`Dr Lena ${client.surename}`);
    await expect(lead).toContainText("09/03/1985");

    await page.getByTestId("passenger-edit-lead").click();
    const dialog = page.getByTestId("dialog-passenger");
    const save = dialog.getByTestId("button-save-passenger");
    await expect(dialog.getByRole("heading", { name: "Lead passenger passport" })).toBeVisible();
    // Only the passport fields are editable for the lead.
    await expect(dialog.getByTestId("input-passenger-first-name")).toHaveCount(0);
    await expect(dialog.getByTestId("input-passenger-dob")).toHaveCount(0);
    await expect(save).toBeDisabled(); // nothing filled in yet
    await expect(dialog.getByTestId("passenger-save-blocked-reason")).toHaveText("Passport number is required");
    await dialog.getByTestId("input-passenger-passport-number").fill("AB12");
    await expect(dialog.getByTestId("passenger-passport-number-error")).toBeVisible();
    await dialog.getByTestId("checkbox-passenger-non-uk").check();
    await dialog.getByTestId("input-passenger-passport-number").fill("ab12345");
    await dialog.getByTestId("input-passenger-passport-expiry").fill(addDaysToKey(today(), 10));
    await expect(dialog.getByTestId("passenger-passport-expiry-error")).toBeVisible();
    await expect(save).toBeDisabled();
    await dialog.getByTestId("input-passenger-passport-expiry").fill(FAR_EXPIRY());
    await expect(save).toBeEnabled();
    await save.click();
    await expect(dialog).toBeHidden();
    await expect(lead).toContainText("AB12345");
    const stored = await queryRows<{ is_lead: boolean; passport_number: string; passport_non_uk: boolean }>(
      `select is_lead, passport_number, passport_non_uk from client_passenger where client_id = $1`,
      [client.id],
    );
    expect(stored).toEqual([{ is_lead: true, passport_number: "AB12345", passport_non_uk: true }]);

    // The server enforces it for the lead too.
    const put = (data: Record<string, unknown>) => page.request.put(`/api/v2/neon-clients/${client.id}/passengers/lead`, { data });
    expect((await put({ passportNumber: "1234", passportExpiry: FAR_EXPIRY() })).status()).toBe(400);
    expect((await put({ passportNumber: "123456789", passportExpiry: addDaysToKey(today(), 10) })).status()).toBe(400);
    expect((await put({ passportNumber: null, passportExpiry: null })).status()).toBe(400);
    expect((await put({ passportNumber: "123456789", passportExpiry: FAR_EXPIRY() })).status()).toBe(200);

    // The lead's name is the client's: change the client and the lead card follows (nothing is copied).
    expect((await page.request.patch(`/api/v2/neon-clients/${client.id}`, { data: { firstName: "Leona" } })).status()).toBe(200);
    await page.reload();
    await expect(page.locator('[data-testid^="passenger-card-"]').first()).toContainText(`Dr Leona ${client.surename}`);
    // The lead cannot be deleted or edited as a normal passenger.
    const leadRow = (await listPassengers(page, client.id)).passengers[0];
    expect((await page.request.delete(`/api/v2/neon-clients/${client.id}/passengers/${leadRow.id}`)).status()).toBe(400);
    expect((await page.request.patch(`/api/v2/neon-clients/${client.id}/passengers/${leadRow.id}`, { data: { firstName: "Hack" } })).status()).toBe(400);
  });

  test("a lead whose client record has no date of birth or title cannot save a passport: Save is off with a clear message and the server refuses", async ({ page }) => {
    const { client } = await agentWithClient(page);
    await queryRows(`update client_table set "DOB" = null, title = null where id = $1`, [client.id]);
    await openClient(page, client.id);
    await page.getByTestId("passenger-edit-lead").click();
    const dialog = page.getByTestId("dialog-passenger");
    await dialog.getByTestId("input-passenger-passport-number").fill("123456789");
    await dialog.getByTestId("input-passenger-passport-expiry").fill(FAR_EXPIRY());
    await expect(dialog.getByTestId("button-save-passenger")).toBeDisabled();
    await expect(dialog.getByTestId("passenger-save-blocked-reason")).toContainText("title and date of birth on the client record");
    const res = await page.request.put(`/api/v2/neon-clients/${client.id}/passengers/lead`, { data: { passportNumber: "123456789", passportExpiry: FAR_EXPIRY() } });
    expect(res.status()).toBe(400);
    expect(await res.text()).toContain("title and date of birth");
    expect(await queryRows(`select 1 from client_passenger where client_id = $1`, [client.id])).toHaveLength(0);
  });
});

test.describe("passengers belong to the client", () => {
  test("each client has its own list, the lead comes first, and the list survives a reload", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.agent.email);
    const a = await apiCreateClient(page.request, { firstName: "Alma" });
    const b = await apiCreateClient(page.request, { firstName: "Bruno" });
    const mk = (clientId: string, first: string) =>
      page.request.post(`/api/v2/neon-clients/${clientId}/passengers`, { data: { title: "Ms", firstName: first, surname: "Guest", dateOfBirth: "1999-09-09", passportNumber: "123456789", passportExpiry: FAR_EXPIRY() } });
    expect((await mk(a.id, "Anna")).status()).toBe(201);
    expect((await mk(a.id, "Aaron")).status()).toBe(201);
    expect((await mk(b.id, "Bella")).status()).toBe(201);

    await openClient(page, a.id);
    await expect(page.getByTestId("passenger-count")).toHaveText("3 passengers");
    await expect(page.locator('[data-testid^="passenger-card-"]')).toHaveCount(3);
    await expect(page.getByTestId("passenger-card-lead")).toContainText(`Alma ${a.surename}`);
    await expect(page.locator('[data-testid^="passenger-card-"]').first()).toHaveAttribute("data-testid", "passenger-card-lead");
    await expect(page.getByText("Bella Guest")).toHaveCount(0);

    await openClient(page, b.id);
    await expect(page.getByTestId("passenger-count")).toHaveText("2 passengers");
    await expect(page.getByText("Bella Guest")).toBeVisible();
    await expect(page.getByText("Anna Guest")).toHaveCount(0);
    expect((await listPassengers(page, a.id)).passengers.map((p) => p.firstName)).toEqual(["Alma", "Anna", "Aaron"]);
  });
});

async function statusOf(page: Page, email: string, clientId: string) {
  await signIn(page, email);
  const client = (await page.request.get(`/api/v2/neon-clients/${clientId}`)).status();
  const list = await page.request.get(`/api/v2/neon-clients/${clientId}/passengers`);
  const write = await page.request.post(`/api/v2/neon-clients/${clientId}/passengers`, {
    data: { title: "Mr.", firstName: "Probe", surname: "Writer", dateOfBirth: "1970-01-01", passportNumber: "999999999", passportExpiry: FAR_EXPIRY() },
  });
  return { client, list: list.status(), write: write.status() };
}

async function clientInShop(page: Page, w: WorkWorld, who: "shop1" | "shop2") {
  await signIn(page, who === "shop1" ? w.agent.email : w.agent2.email);
  return apiCreateClient(page.request);
}

test.describe("who can see and change a client's passengers", () => {
  test("whoever can open the client sees the passengers (and the passport in full); read-only roles cannot change them; another agency, a referral agent and the wrong shop's manager see nothing", async ({ page }) => {
    const w = await workWorld(page);
    const c = await clientInShop(page, w, "shop1");
    const seeded = await page.request.post(`/api/v2/neon-clients/${c.id}/passengers`, {
      data: { title: "Mr.", firstName: "Visible", surname: "Everywhere", dateOfBirth: "1970-01-01", passportNumber: "246813579", passportExpiry: FAR_EXPIRY() },
    });
    expect(seeded.status()).toBe(201);

    // [role, email, client status, list status, write status]
    const expectations: Array<[string, string, number, number, number]> = [
      ["shop-1 agent", w.agent.email, 200, 200, 201],
      ["colleague in the same shop", w.agentB.email, 200, 200, 201],
      // Owner decision (3 Nov): an agent may see and add passengers (passport numbers included) for any client in the agency.
      ["agent of another shop", w.agent2.email, 200, 200, 201],
      ["shop-1 branch manager", w.manager1.email, 200, 200, 201],
      ["org admin", w.admin.email, 200, 200, 201],
      ["social media manager (read-only)", w.smm.email, 200, 200, 403],
      // Owner decision (3 Nov): branch managers stay pinned to their own shop.
      ["another shop's branch manager", w.manager2.email, 404, 404, 404],
      ["homeworker", w.homeworker.email, 404, 404, 404],
      ["another agency's agent", w.foreign.agent.email, 404, 404, 404],
      ["another agency's admin", w.foreign.admin.email, 404, 404, 404],
      ["referral agent", w.referral.email, 403, 403, 403],
    ];
    for (const [who, email, client, list, write] of expectations) {
      expect(await statusOf(page, email, c.id), who).toEqual({ client, list, write });
    }
    // The list and the client always agree: nobody sees passengers of a client they cannot open.
    // Writes by the permitted roles created exactly one passenger each (5 writers: shop-1 agent, colleague, other-shop agent, shop-1 manager, org admin), plus the seeded one.
    await signIn(page, w.admin.email);
    expect((await listPassengers(page, c.id)).passengers.filter((p) => !p.isLead)).toHaveLength(1 + 5);
  });

  test("on screen: an agent sees Add passenger and edit buttons with the passport in full, a social media manager sees the same cards read-only", async ({ page }) => {
    const w = await workWorld(page);
    const c = await clientInShop(page, w, "shop1");
    const created = await dataOf<PassengerApi>(
      await page.request.post(`/api/v2/neon-clients/${c.id}/passengers`, {
        data: { title: "Ms", firstName: "Reader", surname: "Case", dateOfBirth: "1988-08-08", passportNumber: "135792468", passportExpiry: FAR_EXPIRY() },
      }),
      201,
    );

    await signIn(page, w.agentB.email);
    await openClient(page, c.id);
    await expect(page.getByTestId("button-add-passenger")).toBeVisible();
    await expect(page.getByTestId(`passenger-edit-${created.id}`)).toBeVisible();
    await expect(page.getByTestId(`passenger-card-${created.id}`)).toContainText("135792468");

    await signIn(page, w.smm.email);
    await page.goto(`/clients/${c.id}`);
    await expect(page.getByTestId("client-details-panel")).toBeVisible();
    await expect(page.getByTestId(`passenger-card-${created.id}`)).toContainText("135792468");
    await expect(page.getByTestId("passenger-card-lead")).toBeVisible();
    await expect(page.getByTestId("button-add-passenger")).toHaveCount(0);
    await expect(page.getByTestId(`passenger-edit-${created.id}`)).toHaveCount(0);
    await expect(page.getByTestId("passenger-edit-lead")).toHaveCount(0);
  });

  test("another agency's agent opening the client by link gets no client and no passengers; a merged client's passengers can be read but not changed", async ({ page }) => {
    const w = await workWorld(page);
    const c = await clientInShop(page, w, "shop1");
    await signIn(page, w.foreign.agent.email);
    const refused = page.waitForResponse((res) => res.url().includes(`/api/v2/neon-clients/${c.id}`) && res.request().method() === "GET");
    await page.goto(`/clients/${c.id}`);
    expect((await refused).status()).toBe(404); // the server said no, so the absences below mean something
    await expect(page.getByTestId("client-details-panel")).toHaveCount(0);
    await expect(page.getByTestId("passenger-card-lead")).toHaveCount(0);
    await expect(page.getByTestId("button-add-passenger")).toHaveCount(0);

    // Merged: reads stay allowed, every passenger write is a 400 (owner decision).
    await signIn(page, w.agent.email);
    await queryRows(`update client_table set status = 'merged' where id = $1`, [c.id]);
    expect((await page.request.get(`/api/v2/neon-clients/${c.id}/passengers`)).status()).toBe(200);
    const res = await page.request.post(`/api/v2/neon-clients/${c.id}/passengers`, {
      data: { title: "Mr.", firstName: "Late", surname: "Writer", dateOfBirth: "1970-01-01", passportNumber: "999999999", passportExpiry: FAR_EXPIRY() },
    });
    expect(res.status(), await res.text()).toBe(400);
    expect(await res.text()).toContain("merged");
    expect((await page.request.put(`/api/v2/neon-clients/${c.id}/passengers/lead`, { data: { passportNumber: "1", passportExpiry: null } })).status()).toBe(400);
    expect(await queryRows(`select 1 from client_passenger where client_id = $1`, [c.id])).toHaveLength(0);
  });
});

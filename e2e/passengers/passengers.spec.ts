/**
 * Client passengers (the Passengers block on the client page).
 * Owner rules: passengers are saved on the client and the client is the lead (name, title and date of birth come from
 * the client record; only the lead's passport is stored). Add Passenger needs all six fields; a passport number that is
 * not 9 digits only warns; a passport expiring in 6 months or less (against the next booking's departure, else
 * today in UK time) is flagged but never blocks; editing and the lead's passport are never blocked; everyone who can
 * open the client sees the passport numbers in full, read-only roles cannot edit, another agency sees nothing.
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

test.describe("UK passport number length warns but never blocks", () => {
  test("anything but 9 digits shows the warning and still saves; exactly 9 digits shows none", async ({ page }) => {
    const { client } = await agentWithClient(page);
    await openClient(page, client.id);
    const dialog = await openAddModal(page);
    const warning = dialog.getByTestId("passenger-passport-number-warning");
    const number = dialog.getByTestId("input-passenger-passport-number");

    await expect(warning).toHaveCount(0); // empty: nothing to warn about yet
    await number.fill("12345678"); // 8 digits
    await expect(warning).toHaveText("UK passports have 9 numbers. Check this one if it's a UK passport.");
    await number.fill("1234567890"); // 10 digits
    await expect(warning).toBeVisible();
    await number.fill("12345678A"); // a letter
    await expect(warning).toBeVisible();
    await number.fill("123456789");
    await expect(warning).toHaveCount(0);
    await number.fill("X9876543"); // a non-UK style number
    await expect(warning).toBeVisible();

    // The warned number still saves.
    await fillPassenger(page, dialog, { title: "Ms", first: "Ola", last: "Overseas", dob: "1992-02-02", expiry: FAR_EXPIRY() });
    await expect(dialog.getByTestId("button-save-passenger")).toBeEnabled();
    await dialog.getByTestId("button-save-passenger").click();
    await expect(dialog).toBeHidden();
    const saved = (await listPassengers(page, client.id)).passengers.find((p) => p.firstName === "Ola");
    expect(saved?.passportNumber).toBe("X9876543");
  });
});

test.describe("passport expiry flags (6 months or less) never block", () => {
  test("with no booking to travel on, the expiry is checked against today (UK): exactly 6 months and earlier are flagged, a day later is not", async ({ page }) => {
    const { client } = await agentWithClient(page);
    await openClient(page, client.id);
    await expect(page.getByTestId("passenger-footnote")).toContainText("No upcoming bookings yet, so passport expiry is checked against today");

    const sixMonths = plusMonths(today(), 6);
    const cases: Array<{ name: string; expiry: string; flagged: boolean }> = [
      { name: "Expired", expiry: addDaysToKey(today(), -30), flagged: true },
      { name: "Exactly", expiry: sixMonths, flagged: true },
      { name: "Later", expiry: addDaysToKey(sixMonths, 1), flagged: false },
    ];
    for (const c of cases) {
      const dialog = await openAddModal(page);
      await fillPassenger(page, dialog, { title: "Miss", first: c.name, last: "Flag", dob: "2000-01-01", number: "123456789", expiry: c.expiry });
      // The flag shows inside the form before saving...
      if (c.flagged) await expect(dialog.getByTestId("passenger-passport-expiry-flag"), c.name).toHaveText("6 months or less left");
      else await expect(dialog.getByTestId("passenger-passport-expiry-flag"), c.name).toHaveCount(0);
      // ...and never stops the save.
      await expect(dialog.getByTestId("button-save-passenger")).toBeEnabled();
      await dialog.getByTestId("button-save-passenger").click();
      await expect(dialog).toBeHidden();
    }
    const list = (await listPassengers(page, client.id)).passengers;
    for (const c of cases) expect(list.find((p) => p.firstName === c.name)?.passportWarning, c.name).toBe(c.flagged);
    // On the cards: exactly two warnings.
    await page.reload();
    await expect(page.getByTestId("passenger-card-lead")).toBeVisible();
    await expect(page.getByTestId("passenger-passport-warning")).toHaveCount(2);
  });

  test("with a booking to come, the expiry is checked against the next departure: 6 months after it is flagged, a day later is not; quotes, lost and past bookings do not set the departure", async ({ page }) => {
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

    const sixAfter = plusMonths(next, 6);
    await page.request.post(`/api/v2/neon-clients/${client.id}/passengers`, { data: { title: "Mr.", firstName: "Edge", surname: "Exact", dateOfBirth: "1980-01-01", passportNumber: "111111111", passportExpiry: sixAfter } });
    await page.request.post(`/api/v2/neon-clients/${client.id}/passengers`, { data: { title: "Mr.", firstName: "Edge", surname: "Later", dateOfBirth: "1980-01-01", passportNumber: "222222222", passportExpiry: addDaysToKey(sixAfter, 1) } });
    // Seven months from today: fine against today, but inside 6 months of a departure 90 days away.
    await page.request.post(`/api/v2/neon-clients/${client.id}/passengers`, { data: { title: "Mr.", firstName: "Edge", surname: "Between", dateOfBirth: "1980-01-01", passportNumber: "333333333", passportExpiry: plusMonths(today(), 7) } });

    const api = await listPassengers(page, client.id);
    expect(api.nextDeparture).toBe(next);
    const byName = (s: string) => api.passengers.find((p) => p.surname === s)!;
    expect(byName("Exact").passportWarning).toBe(true);
    expect(byName("Later").passportWarning).toBe(false);
    // 7 months from today is not within 6 months of today, but IS within 6 months of a departure 90 days away.
    expect(byName("Between").passportWarning).toBe(true);

    await openClient(page, client.id);
    const longDate = shortLongDate(next);
    await expect(page.getByTestId("passenger-footnote")).toContainText(`checked against the next departure, ${longDate}`);
    const card = page.getByTestId(`passenger-card-${byName("Exact").id}`);
    await expect(card.getByTestId("passenger-passport-warning")).toHaveText("6 months or less at travel");
    await expect(page.getByTestId(`passenger-card-${byName("Later").id}`).getByTestId("passenger-passport-warning")).toHaveCount(0);
  });
});

test.describe("editing is never blocked", () => {
  test("an older passenger with gaps can be edited with only names, fields can be cleared, and the passenger can be deleted", async ({ page }) => {
    const { client } = await agentWithClient(page);
    // A record from before all six were mandatory: names only.
    const [row] = await queryRows<{ id: string }>(
      `insert into client_passenger (client_id, is_lead, first_name, surname) values ($1, false, 'Old', 'Record') returning id`,
      [client.id],
    );
    await openClient(page, client.id);
    const card = page.getByTestId(`passenger-card-${row.id}`);
    await expect(card).toContainText("Old Record");
    await card.getByTestId(`passenger-edit-${row.id}`).click();
    const dialog = page.getByTestId("dialog-passenger");
    await expect(dialog.getByRole("heading", { name: "Edit passenger" })).toBeVisible();
    // With nothing but the names the Save button is enabled (adding would need all six).
    await expect(dialog.getByTestId("button-save-passenger")).toBeEnabled();
    await dialog.getByTestId("input-passenger-passport-number").fill("12345");
    await expect(dialog.getByTestId("passenger-passport-number-warning")).toBeVisible();
    await dialog.getByTestId("input-passenger-passport-expiry").fill(addDaysToKey(today(), 30)); // soon: flagged, still allowed
    await expect(dialog.getByTestId("passenger-passport-expiry-flag")).toBeVisible();
    await dialog.getByTestId("button-save-passenger").click();
    await expect(dialog).toBeHidden();
    const saved = (await listPassengers(page, client.id)).passengers.find((p) => p.id === row.id)!;
    expect(saved).toMatchObject({ firstName: "Old", surname: "Record", passportNumber: "12345", passportWarning: true, title: null, dateOfBirth: null });

    // Clearing the passport number and expiry again is allowed, and only a missing name blocks an edit.
    await page.getByTestId(`passenger-edit-${row.id}`).click();
    await dialog.getByTestId("input-passenger-passport-number").fill("");
    await dialog.getByTestId("input-passenger-passport-expiry").fill("");
    await dialog.getByTestId("input-passenger-first-name").fill("");
    await expect(dialog.getByTestId("button-save-passenger")).toBeDisabled();
    await dialog.getByTestId("input-passenger-first-name").fill("Older");
    await dialog.getByTestId("button-save-passenger").click();
    await expect(dialog).toBeHidden();
    const cleared = (await listPassengers(page, client.id)).passengers.find((p) => p.id === row.id)!;
    expect(cleared).toMatchObject({ firstName: "Older", passportNumber: null, passportExpiry: null, passportWarning: false });

    // Delete it.
    await page.getByTestId(`passenger-edit-${row.id}`).click();
    await dialog.getByTestId("button-delete-passenger").click();
    await page.getByTestId("button-confirm-delete-passenger").click();
    await expect(page.getByTestId(`passenger-card-${row.id}`)).toHaveCount(0);
    expect(await queryRows(`select 1 from client_passenger where id = $1`, [row.id])).toHaveLength(0);
  });

  test("the lead's passport can be saved with any value (warned, never blocked) while name and date of birth come from the client", async ({ page }) => {
    const { client } = await agentWithClient(page, { title: "Dr", firstName: "Lena", DOB: "1985-03-09" });
    await openClient(page, client.id);
    // The lead is always the first card (its test id changes from "lead" to its row id once a passport has been saved).
    const lead = page.locator('[data-testid^="passenger-card-"]').first();
    await expect(lead).toContainText("LEAD PASSENGER");
    await expect(lead).toContainText(`Dr Lena ${client.surename}`);
    await expect(lead).toContainText("09/03/1985");

    await page.getByTestId("passenger-edit-lead").click();
    const dialog = page.getByTestId("dialog-passenger");
    await expect(dialog.getByRole("heading", { name: "Lead passenger passport" })).toBeVisible();
    // Only the passport fields are editable for the lead.
    await expect(dialog.getByTestId("input-passenger-first-name")).toHaveCount(0);
    await expect(dialog.getByTestId("input-passenger-dob")).toHaveCount(0);
    await expect(dialog.getByTestId("button-save-passenger")).toBeEnabled(); // even with nothing filled in
    await dialog.getByTestId("input-passenger-passport-number").fill("AB12");
    await expect(dialog.getByTestId("passenger-passport-number-warning")).toBeVisible();
    await dialog.getByTestId("input-passenger-passport-expiry").fill(addDaysToKey(today(), 10));
    await dialog.getByTestId("button-save-passenger").click();
    await expect(dialog).toBeHidden();
    await expect(lead).toContainText("AB12");
    await expect(lead.getByTestId("passenger-passport-warning")).toBeVisible();
    const stored = await queryRows<{ is_lead: boolean; passport_number: string }>(`select is_lead, passport_number from client_passenger where client_id = $1`, [client.id]);
    expect(stored).toEqual([{ is_lead: true, passport_number: "AB12" }]);

    // The lead's name is the client's: change the client and the lead card follows (nothing is copied).
    expect((await page.request.patch(`/api/v2/neon-clients/${client.id}`, { data: { firstName: "Leona" } })).status()).toBe(200);
    await page.reload();
    await expect(page.locator('[data-testid^="passenger-card-"]').first()).toContainText(`Dr Leona ${client.surename}`);
    // The lead cannot be deleted or edited as a normal passenger.
    const leadRow = (await listPassengers(page, client.id)).passengers[0];
    expect((await page.request.delete(`/api/v2/neon-clients/${client.id}/passengers/${leadRow.id}`)).status()).toBe(400);
    expect((await page.request.patch(`/api/v2/neon-clients/${client.id}/passengers/${leadRow.id}`, { data: { firstName: "Hack" } })).status()).toBe(400);
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

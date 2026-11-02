/**
 * The admin dashboard (/agency/overview) and the branch manager's view (/branch-overview).
 *
 * Real and tested: the headline band and sales-health strip (profit per booking includes upsells), the team table,
 * and the "Departures and balances" card (live data). Deliberately NOT tested because they are hard-coded sample
 * content with a "Sample" pill (owner decision): Luna's morning briefing. Only the fact that it is labelled as a sample is checked.
 * Scope is fail closed: the agency admin sees their own agency only; a platform admin without an agency gets a 403 and a
 * clear message; a branch manager, agent or homeworker has no agency overview.
 */
import { ukAddDays, ukDateString, ukMonthEnd, ukStartOfDay, ukStartOfMonth, ukStartOfWeek } from "../../server/v2/utils/london-dates";
import { apiCreateClient, dataOf, signIn } from "../helpers/deals";
import { expect, expectLoginOk, test } from "../helpers/fixtures";
import { londonAt, pinLondonHelpers } from "../helpers/london";
import { queryRows, seedPlatformAdmin, TEST_PASSWORD } from "../helpers/seed";
import { seedBooking, seedUpsell, workWorld, type WorkWorld } from "../helpers/work";

pinLondonHelpers("day", "week", "month");

const MIN = 60_000;
const DAY = 86_400_000;
const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
const gbp2 = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

interface Fact {
  at: Date;
  commission: number;
}

function sumIn(facts: Fact[], from: Date, to?: Date) {
  const hit = facts.filter((f) => f.at >= from && (!to || f.at < to));
  return { sum: hit.reduce((s, f) => s + f.commission, 0), n: hit.length };
}

async function client(page: import("@playwright/test").Page) {
  return apiCreateClient(page.request);
}

/** Money seeded across two shops of one agency and a second agency; returns the facts the dashboard must add up. */
async function seedMoney(page: import("@playwright/test").Page, w: WorkWorld) {
  const now = new Date();
  const todayStart = ukStartOfDay(now);
  const weekStart = ukStartOfWeek(now);
  const monthStart = ukStartOfMonth(now);
  const world = (userId: string, clientId: string) => ({ agency: w.agency, userId, clientId, clientSurname: "" });

  const bookings: Fact[] = [];
  const upsells: Fact[] = [];

  await signIn(page, w.agent.email);
  const c1 = await client(page);
  const a1 = await seedBooking(page.request, world(w.agent.id, c1.id), { title: "Shop1 today", packageCommission: 240, transferCommission: 4, createdAt: new Date(todayStart.getTime() + 1 * MIN) });
  bookings.push({ at: new Date(todayStart.getTime() + MIN), commission: a1.commission });
  const a2 = await seedBooking(page.request, world(w.agent.id, c1.id), { title: "Shop1 old", packageCommission: 900, createdAt: new Date(monthStart.getTime() - 2 * DAY) });
  bookings.push({ at: new Date(monthStart.getTime() - 2 * DAY), commission: a2.commission });
  // An upsell added today on last month's booking counts today; one added last month on today's booking does not.
  await seedUpsell(page.request, a2.bookingId, { commission: 30, salesPrice: 60, addedAt: new Date(todayStart.getTime() + 2 * MIN) });
  upsells.push({ at: new Date(todayStart.getTime() + 2 * MIN), commission: 30 });
  await seedUpsell(page.request, a1.bookingId, { commission: 99, addedAt: new Date(monthStart.getTime() - 5 * DAY) });
  upsells.push({ at: new Date(monthStart.getTime() - 5 * DAY), commission: 99 });
  const gone = await seedUpsell(page.request, a1.bookingId, { commission: 11, addedAt: new Date(todayStart.getTime() + 3 * MIN) });
  expect((await page.request.delete(`/api/v2/upsells/${gone}`)).status()).toBe(200);
  // An inactive booking never counts.
  const inactive = await seedBooking(page.request, world(w.agent.id, c1.id), { title: "Shop1 inactive", packageCommission: 500, createdAt: new Date(todayStart.getTime() + 4 * MIN) });
  await queryRows(`update booking_table set is_active = false where id = $1`, [inactive.bookingId]);

  await signIn(page, w.agent2.email);
  const c2 = await client(page);
  const b1 = await seedBooking(page.request, world(w.agent2.id, c2.id), { title: "Shop2 month", packageCommission: 120, createdAt: new Date(monthStart.getTime() + 2 * MIN) });
  bookings.push({ at: new Date(monthStart.getTime() + 2 * MIN), commission: b1.commission });
  const b2 = await seedBooking(page.request, world(w.agent2.id, c2.id), { title: "Shop2 today", packageCommission: 60, createdAt: new Date(todayStart.getTime() + 5 * MIN) });
  bookings.push({ at: new Date(todayStart.getTime() + 5 * MIN), commission: b2.commission });

  // Another agency, same day: must never appear.
  await signIn(page, w.foreign.agent.email);
  const fc = await client(page);
  const foreignWorld = { agency: { ...w.agency, orgId: w.foreign.orgId, branchId: w.foreign.branchId, ref: w.agency.ref }, userId: w.foreign.agent.id, clientId: fc.id, clientSurname: "" };
  await seedBooking(page.request, foreignWorld, { title: "Foreign today", packageCommission: 4000, createdAt: new Date(todayStart.getTime() + 6 * MIN) });

  const today = sumIn([...bookings, ...upsells], todayStart);
  const week = sumIn([...bookings, ...upsells], weekStart);
  const month = sumIn([...bookings, ...upsells], monthStart, ukMonthEnd(now));
  return {
    bookings,
    upsells,
    expected: {
      today: today.sum,
      week: week.sum,
      month: month.sum,
      todayCount: sumIn(bookings, todayStart).n,
      weekCount: sumIn(bookings, weekStart).n,
      monthCount: sumIn(bookings, monthStart, ukMonthEnd(now)).n,
      monthUpsell: sumIn(upsells, monthStart, ukMonthEnd(now)).sum,
    },
    ids: { a1, a2, b1, b2 },
  };
}

test.describe("headline band and sales health", () => {
  test("Today, Week and Month profit add booking + line-item + upsell commission for the whole agency in UK windows; PPB includes upsells; another agency is left out", async ({ page }) => {
    const w = await workWorld(page);
    const m = await seedMoney(page, w);
    await signIn(page, w.admin.email);
    const stats = page.waitForResponse((r) => r.url().includes("/api/v2/organization-overview/stats"));
    await Promise.all([stats, page.goto("/agency/overview")]);
    expect((await stats).status()).toBe(200);
    await expect(page.getByTestId("admin-headline-band")).toBeVisible();

    const e = m.expected;
    expect(e.today).toBeGreaterThanOrEqual(244 + 30 + 60); // the windows are doing work, not all zero
    await expect(page.getByTestId("stat-value-todays-profit")).toHaveText(gbp(e.today));
    await expect(page.getByTestId("stat-value-weeks-profit")).toHaveText(gbp(e.week));
    await expect(page.getByTestId("stat-value-this-month")).toHaveText(gbp(e.month));
    await expect(page.getByTestId("stat-box-todays-profit")).toContainText(`From ${plural(e.todayCount, "booking")} today`);
    await expect(page.getByTestId("stat-box-weeks-profit")).toContainText(`From ${plural(e.weekCount, "booking")} this week`);
    await expect(page.getByTestId("stat-box-this-month")).toContainText(plural(e.monthCount, "booking"));
    // An upsell is always added today (30), so this month's upsell amount is always shown.
    expect(e.monthUpsell).toBeGreaterThan(0);
    await expect(page.getByTestId("stat-upsell-amount-this-month")).toHaveText(gbp(e.monthUpsell));

    // Profit per booking = month profit INCLUDING upsells / this month's bookings (owner decision), in pounds and pence.
    await expect(page.getByTestId("stat-value-avg-ppb")).toHaveText(gbp2(e.monthCount > 0 ? e.month / e.monthCount : 0));
    // No monthly target is set: the band says so and offers the link.
    await expect(page.getByTestId("stat-value-target")).toHaveText("–");
    await expect(page.getByTestId("link-admin-set-target")).toBeVisible();

    // The server's own figures agree.
    const api = await dataOf<{ kpis: { todayCommission: number; weekCommission: number; monthCommission: number; monthBookingsCount: number; monthUpsellCommission: number } }>(
      await page.request.get("/api/v2/organization-overview/stats"),
    );
    expect(Number(api.kpis.todayCommission)).toBe(e.today);
    expect(Number(api.kpis.weekCommission)).toBe(e.week);
    expect(Number(api.kpis.monthCommission)).toBe(e.month);
    expect(Number(api.kpis.monthBookingsCount)).toBe(e.monthCount);
    expect(Number(api.kpis.monthUpsellCommission)).toBe(e.monthUpsell);
  });

  test("the team table shows each agent's own today / week / month, with an upsell credited to the month it was added, and nobody from another agency", async ({ page }) => {
    const w = await workWorld(page);
    const m = await seedMoney(page, w);
    await signIn(page, w.admin.email);
    await page.goto("/agency/overview");
    const row = (id: string) => page.getByTestId(`row-multi-branch-agent-${id}`);
    await expect(row(w.agent.id)).toBeVisible();
    await expect(row(w.agent2.id)).toBeVisible();

    const now = new Date();
    const todayStart = ukStartOfDay(now);
    const weekStart = ukStartOfWeek(now);
    const monthStart = ukStartOfMonth(now);
    const monthEnd = ukMonthEnd(now);
    // Agent one: today booking (244) + last month's booking (900, outside) + upsell added today on it (30): today 274; the 99 upsell was last month.
    const agent1Facts: Fact[] = [m.bookings[0], m.bookings[1], m.upsells[0], m.upsells[1]];
    const agent2Facts: Fact[] = [m.bookings[2], m.bookings[3]];
    // Columns after the name: Today, Week, Month. Each cell is checked with a retrying assertion.
    const cell = (id: string, n: number) => row(id).locator("td").nth(n);
    await expect(cell(w.agent.id, 1)).toHaveText(gbp(sumIn(agent1Facts, todayStart).sum));
    await expect(cell(w.agent.id, 2)).toHaveText(gbp(sumIn(agent1Facts, weekStart).sum));
    await expect(cell(w.agent.id, 3)).toHaveText(gbp(sumIn(agent1Facts, monthStart, monthEnd).sum));
    await expect(cell(w.agent2.id, 1)).toHaveText(gbp(sumIn(agent2Facts, todayStart).sum));
    await expect(cell(w.agent2.id, 2)).toHaveText(gbp(sumIn(agent2Facts, weekStart).sum));
    await expect(cell(w.agent2.id, 3)).toHaveText(gbp(sumIn(agent2Facts, monthStart, monthEnd).sum));
    await expect(row(w.foreign.agent.id)).toHaveCount(0);
  });
});

test.describe("departures and balances (live)", () => {
  test("the card lists departures from today to today + 7 only, counts them, and its pill follows the ticks", async ({ page }) => {
    const w = await workWorld(page);
    const today = new Date();
    const dayKey = (n: number) => ukDateString(ukAddDays(today, n));
    const world = (userId: string, clientId: string) => ({ agency: w.agency, userId, clientId, clientSurname: "" });
    await signIn(page, w.agent.email);
    const mk = async (title: string, n: number) => {
      const c = await apiCreateClient(page.request);
      const b = await seedBooking(page.request, world(w.agent.id, c.id), { title, packageCommission: 100, createdAt: new Date(), travelDate: dayKey(n) });
      return { ...b, client: c, name: `Cora ${c.surename}` };
    };
    const dToday = await mk("Departs today", 0);
    const d7 = await mk("Departs in 7", 7);
    const d8 = await mk("Departs in 8", 8);
    const dPast = await mk("Departed yesterday", -1);
    const dLost = await mk("Lost booking", 3);
    await queryRows(`update booking_table set booking_status = 'LOST' where id = $1`, [dLost.bookingId]);
    // Another shop of the same agency: part of the agency card. Another agency: never.
    await signIn(page, w.agent2.email);
    const c2 = await apiCreateClient(page.request);
    const shop2 = await seedBooking(page.request, world(w.agent2.id, c2.id), { title: "Shop two departure", packageCommission: 50, createdAt: new Date(), travelDate: dayKey(2) });
    await signIn(page, w.foreign.agent.email);
    const fc = await apiCreateClient(page.request);
    const foreign = await seedBooking(page.request, { agency: { ...w.agency, orgId: w.foreign.orgId, branchId: w.foreign.branchId }, userId: w.foreign.agent.id, clientId: fc.id, clientSurname: "" }, { title: "Foreign departure", packageCommission: 50, createdAt: new Date(), travelDate: dayKey(1) });

    await signIn(page, w.admin.email);
    await page.goto("/agency/overview");
    const card = page.getByTestId("card-departures");
    await expect(card).toBeVisible();
    await expect(page.getByTestId("text-departures-summary")).toBeVisible();
    const row = (id: string) => card.getByTestId(`row-departure-${id}`);
    await expect(row(dToday.bookingId)).toBeVisible();
    await expect(row(d7.bookingId)).toBeVisible();
    await expect(row(shop2.bookingId)).toBeVisible();
    for (const out of [d8, dPast, dLost, foreign]) await expect(row(out.bookingId)).toHaveCount(0);
    await expect(card.locator('[data-testid^="row-departure-"]')).toHaveCount(3);
    // Nothing ticked yet: three departures, none fully paid, none with passport info.
    await expect(page.getByTestId("text-departures-summary")).toHaveText("3 departures · 3 not fully paid · 3 passport info missing");
    await expect(page.getByTestId("segment-departures-all")).toContainText("All 3");
    await expect(page.getByTestId("segment-departures-action")).toContainText("Needs action 3");
    await expect(row(dToday.bookingId)).toContainText(dToday.name);
    await expect(row(dToday.bookingId)).toContainText("Passport info missing");

    // Tick passport info on the first departure, and everything (incl. fully paid and completed) on the second.
    const tick = async (id: string, key: string, value = true) =>
      expect((await page.request.patch(`/api/v2/departures/${id}/checks`, { data: { key, value } })).status()).toBe(200);
    await tick(dToday.bookingId, "passportInfo");
    for (const key of ["checkIn", "ticketsInHouse", "passportInfo", "ticketsPickUp", "fullyPaid", "completed"]) await tick(d7.bookingId, key);
    await page.reload();
    await expect(row(dToday.bookingId)).toContainText("Balance not paid");
    await expect(row(d7.bookingId)).toContainText("All set");
    await expect(row(shop2.bookingId)).toContainText("Passport info missing");
    await expect(page.getByTestId("text-departures-summary")).toHaveText("3 departures · 2 not fully paid · 1 passport info missing");
    await expect(page.getByTestId("segment-departures-action")).toContainText("Needs action 2");
    await page.getByTestId("segment-departures-action").click();
    await expect(row(d7.bookingId)).toHaveCount(0);
    await expect(row(dToday.bookingId)).toBeVisible();
    await expect(card.locator('[data-testid^="row-departure-"]')).toHaveCount(2);
  });

  test("a branch manager sees only their shop's departures through the API, an agent is refused, and another agency's admin sees none of ours", async ({ page }) => {
    const w = await workWorld(page);
    const key = ukDateString(ukAddDays(new Date(), 2));
    await signIn(page, w.agent.email);
    const c1 = await apiCreateClient(page.request);
    const s1 = await seedBooking(page.request, { agency: w.agency, userId: w.agent.id, clientId: c1.id, clientSurname: "" }, { title: "S1", packageCommission: 10, createdAt: new Date(), travelDate: key });
    await signIn(page, w.agent2.email);
    const c2 = await apiCreateClient(page.request);
    const s2 = await seedBooking(page.request, { agency: w.agency, userId: w.agent2.id, clientId: c2.id, clientSurname: "" }, { title: "S2", packageCommission: 10, createdAt: new Date(), travelDate: key });

    const ids = async (email: string) => {
      await signIn(page, email);
      const res = await page.request.get("/api/v2/departures");
      return { status: res.status(), ids: res.status() === 200 ? (((await res.json()) as { data: { rows: { bookingId: string }[] } }).data.rows.map((r) => r.bookingId).sort()) : [] };
    };
    expect(await ids(w.manager1.email)).toEqual({ status: 200, ids: [s1.bookingId] });
    expect(await ids(w.manager2.email)).toEqual({ status: 200, ids: [s2.bookingId] });
    expect(await ids(w.admin.email)).toEqual({ status: 200, ids: [s1.bookingId, s2.bookingId].sort() });
    expect((await ids(w.agent.email)).status).toBe(403);
    expect((await ids(w.homeworker.email)).status).toBe(403);
    expect(await ids(w.foreign.admin.email)).toEqual({ status: 200, ids: [] });
    // A manager cannot tick another shop's booking.
    await signIn(page, w.manager1.email);
    expect((await page.request.patch(`/api/v2/departures/${s2.bookingId}/checks`, { data: { key: "checkIn", value: true } })).status()).toBe(404);
  });
});

test.describe("sample cards are labelled as samples", () => {
  test("Luna's morning briefing carries a Sample pill (hard-coded on purpose); the live cards do not", async ({ page }) => {
    const w = await workWorld(page);
    await signIn(page, w.admin.email);
    await page.goto("/agency/overview");
    const briefing = page.getByTestId("briefing-body");
    await expect(briefing).toBeVisible();
    await expect(page.getByText("Sample", { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("card-departures").getByText("Sample", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("admin-headline-band").getByText("Sample", { exact: true })).toHaveCount(0);
  });
});

test.describe("who has an agency overview, and whose figures", () => {
  test("only the agency's own admin (or a platform admin inside an agency) can read it; every other role gets 403 and the page says so", async ({ page }) => {
    const w = await workWorld(page);
    for (const [who, email] of [
      ["branch manager", w.manager1.email],
      ["agent", w.agent.email],
      ["homeworker", w.homeworker.email],
      ["social media manager", w.smm.email],
    ] as const) {
      await signIn(page, email);
      for (const path of ["stats", "agents-performance?range=month", "branches-performance?range=month", "profit-sources", "compare?period=month&against=prev"]) {
        const res = await page.request.get(`/api/v2/organization-overview/${path}`);
        expect(res.status(), `${who} ${path} ${await res.text()}`).toBe(403);
      }
    }
    // The page itself: a manager is sent to the Access denied screen.
    await signIn(page, w.manager1.email);
    await page.goto("/agency/overview");
    await expect(page.getByRole("heading", { name: /Access denied/ })).toBeVisible();
    await expect(page.getByTestId("admin-headline-band")).toHaveCount(0);

    // The other agency's admin sees their own (empty) agency, not ours.
    await signIn(page, w.admin.email);
    const ours = await dataOf<{ organization: { name: string } | null }>(await page.request.get("/api/v2/organization-overview/stats"));
    await signIn(page, w.foreign.admin.email);
    const theirs = await dataOf<{ organization: { name: string } | null; kpis: { monthBookingsCount: number } }>(await page.request.get("/api/v2/organization-overview/stats"));
    expect(theirs.organization?.name).not.toBe(ours.organization?.name);
    expect(Number(theirs.kpis.monthBookingsCount)).toBe(0);
  });

  test("a platform admin with no agency in context is refused (403) and the page shows no figures", async ({ page }) => {
    const admin = await seedPlatformAdmin();
    await expectLoginOk(page.request, admin.email, TEST_PASSWORD);
    const res = await page.request.get("/api/v2/organization-overview/stats");
    expect(res.status(), await res.text()).toBe(403);
    expect(await res.text()).toContain("Select an organisation first");
    const dep = await page.request.get("/api/v2/departures");
    expect(dep.status(), await dep.text()).toBe(403);
    await page.goto("/agency/overview");
    // The page shows the "needs an organisation" screen (a 403 is the expected answer, not a failure to load).
    await expect(page.getByTestId("organization-overview-no-org")).toBeVisible();
    await expect(page.getByTestId("organization-overview-error")).toHaveCount(0);
    await expect(page.getByTestId("admin-headline-band")).toHaveCount(0);
    await expect(page.getByTestId("card-departures")).toHaveCount(0);
  });

  // Regression test: the dashboard used to read error.response.status while the shared axios interceptor re-throws an
  // Error with .status, so this screen could never appear and a platform admin saw "Couldn't load agency overview".
  test("a platform admin with no agency is told to open an agency from All Agencies", async ({ page }) => {
    const admin = await seedPlatformAdmin();
    await expectLoginOk(page.request, admin.email, TEST_PASSWORD);
    await page.goto("/agency/overview");
    const noOrg = page.getByTestId("organization-overview-no-org");
    await expect(noOrg).toBeVisible();
    await expect(noOrg).toContainText("This dashboard needs an organisation");
    await expect(noOrg).toContainText("open an agency from All Agencies");
    await expect(page.getByTestId("organization-overview-error")).toHaveCount(0);
  });
});

test.describe("the branch manager's own overview", () => {
  test("the branch overview shows this shop's month only: shop two's and another agency's bookings are left out", async ({ page }) => {
    const w = await workWorld(page);
    const monthStart = ukStartOfMonth(new Date());
    const world = (userId: string, clientId: string) => ({ agency: w.agency, userId, clientId, clientSurname: "" });
    // Noon (UK) on the 4th of this month and noon (UK) ten days before it began: well inside each month, built from a UK
    // date and clock time, so neither the server's zone nor a clock-change day can move them across a month line.
    const inMonth = londonAt(ukDateString(ukAddDays(monthStart, 3)), "12:00");
    const lastMonth = londonAt(ukDateString(ukAddDays(monthStart, -10)), "12:00");
    await signIn(page, w.agent.email);
    const c1 = await apiCreateClient(page.request);
    await seedBooking(page.request, world(w.agent.id, c1.id), { title: "Shop one in month", packageCommission: 300, transferCommission: 20, createdAt: inMonth });
    await seedBooking(page.request, world(w.agent.id, c1.id), { title: "Shop one last month", packageCommission: 777, createdAt: lastMonth });
    await signIn(page, w.agent2.email);
    const c2 = await apiCreateClient(page.request);
    await seedBooking(page.request, world(w.agent2.id, c2.id), { title: "Shop two in month", packageCommission: 5000, createdAt: inMonth });

    await signIn(page, w.manager1.email);
    await page.goto("/branch-overview");
    await expect(page.getByTestId("branch-overview-kpi-grid")).toBeVisible();
    await expect(page.getByTestId("stat-value-month")).toHaveText(gbp(320));
    await expect(page.getByTestId("stat-value-total-bookings")).toHaveText("1");

    await signIn(page, w.manager2.email);
    await page.goto("/branch-overview");
    await expect(page.getByTestId("stat-value-month")).toHaveText(gbp(5000));
    await expect(page.getByTestId("stat-value-total-bookings")).toHaveText("1");
  });

  // Owner decision: the branch overview's Today, Week and Month are UK (Europe/London) days, like every other dashboard,
  // whatever zone the server runs in. (The unit test getBranchOverviewWindows pins the 23:30 / 00:30 boundary by hand.)
  test("the branch overview's Today starts at UK midnight: a booking at 23:30 yesterday (UK) is not today's", async ({ page }) => {
    const w = await workWorld(page);
    const todayStart = ukStartOfDay(new Date());
    await signIn(page, w.agent.email);
    const c1 = await apiCreateClient(page.request);
    const world = { agency: w.agency, userId: w.agent.id, clientId: c1.id, clientSurname: "" };
    await seedBooking(page.request, world, { title: "Late yesterday", packageCommission: 111, createdAt: new Date(todayStart.getTime() - 30 * MIN) });
    await seedBooking(page.request, world, { title: "Early today", packageCommission: 22, createdAt: new Date(todayStart.getTime() + 30 * MIN) });
    await signIn(page, w.manager1.email);
    await page.goto("/branch-overview");
    await expect(page.getByTestId("branch-overview-kpi-grid")).toBeVisible();
    await expect(page.getByTestId("stat-value-today")).toHaveText("£22");
  });
});
